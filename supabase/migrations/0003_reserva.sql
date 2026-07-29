-- Reserva em transação única.
--
-- Dois clientes tocando o mesmo horário ao mesmo tempo: a constraint de
-- exclusão em appointments deixa um passar e derruba o outro. Aqui a gente
-- traduz esse tombo em uma mensagem que dá para mostrar na tela.
--
-- Roda como SECURITY DEFINER porque precisa ler expediente, pausas e clube
-- para validar — mas nunca confia no que veio da tela: revalida tudo.

create or replace function public.reservar(
  p_barbearia   uuid,
  p_barbeiro    uuid,
  p_servico     uuid,
  p_nome        text,
  p_telefone    text,
  p_inicio      timestamptz,
  p_usar_clube  boolean default false,
  p_origem      text default 'link'
) returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_servico    services%rowtype;
  v_casa       barbershops%rowtype;
  v_cliente    clients%rowtype;
  v_assinatura subscriptions%rowtype;
  v_fim        timestamptz;
  v_dow        int;
  v_hora_ini   time;
  v_hora_fim   time;
  v_data       date;
  v_valor      int;
  v_status     app.status_agendamento;
  v_usados     int;
  v_id         uuid;
  v_token      text;
begin
  select * into v_casa from barbershops where id = p_barbearia;
  if not found then
    raise exception 'barbearia_inexistente' using errcode = 'P0002';
  end if;

  select * into v_servico
    from services
   where id = p_servico and barbershop_id = p_barbearia and ativo;
  if not found then
    raise exception 'servico_indisponivel' using errcode = 'P0002';
  end if;

  if p_inicio <= now() then
    raise exception 'horario_no_passado' using errcode = 'P0001';
  end if;

  v_fim := p_inicio + make_interval(mins => v_servico.duracao_min);

  -- Tudo comparado no fuso da casa, não no do servidor.
  v_data     := (p_inicio at time zone 'America/Fortaleza')::date;
  v_hora_ini := (p_inicio at time zone 'America/Fortaleza')::time;
  v_hora_fim := (v_fim    at time zone 'America/Fortaleza')::time;
  v_dow      := extract(dow from (p_inicio at time zone 'America/Fortaleza'));

  if exists (
    select 1 from closures
     where barbershop_id = p_barbearia and data = v_data
  ) then
    raise exception 'casa_fechada' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from working_hours w
     where w.barber_id = p_barbeiro
       and w.dia_semana = v_dow
       and w.ativo
       and v_hora_ini >= w.abre
       and v_hora_fim <= w.fecha
  ) then
    raise exception 'fora_do_expediente' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from breaks b
     where b.barber_id = p_barbeiro
       and (b.dia_semana = v_dow or b.data = v_data)
       and v_hora_ini < b.fim
       and b.inicio < v_hora_fim
  ) then
    raise exception 'horario_bloqueado' using errcode = 'P0001';
  end if;

  -- Cliente é identificado pelo telefone: sem cadastro, sem senha.
  insert into clients (barbershop_id, nome, telefone)
       values (p_barbearia, p_nome, p_telefone)
  on conflict (barbershop_id, telefone)
    do update set nome = excluded.nome
    returning * into v_cliente;

  v_valor := v_servico.preco_centavos;

  if p_usar_clube then
    select * into v_assinatura
      from subscriptions
     where client_id = v_cliente.id and status = 'ativa'
       for update;

    if not found then
      raise exception 'sem_assinatura_ativa' using errcode = 'P0001';
    end if;

    if v_assinatura.ciclo_fim < current_date then
      raise exception 'assinatura_vencida' using errcode = 'P0001';
    end if;

    if not v_servico.coberto_pelo_clube then
      raise exception 'servico_fora_do_clube' using errcode = 'P0001';
    end if;

    select count(*) into v_usados
      from subscription_uses u
      join appointments a on a.id = u.appointment_id
     where u.subscription_id = v_assinatura.id
       and u.usado_em >= v_assinatura.ciclo_inicio
       and a.status <> 'cancelado';

    if v_usados >= v_assinatura.cortes_mes then
      raise exception 'creditos_esgotados' using errcode = 'P0001';
    end if;

    v_valor := greatest(0, v_servico.preco_centavos - v_servico.abate_centavos);
  end if;

  -- Quem já faltou três vezes paga adiantado, custe o que custar a regra geral.
  if v_valor = 0 then
    v_status := 'confirmado';
  elsif v_casa.pagamento_modalidade = 'obrigatorio' or v_cliente.faltas >= 3 then
    v_status := 'pendente_pagamento';
  else
    v_status := 'confirmado';
  end if;

  begin
    insert into appointments (
      barbershop_id, barber_id, client_id, service_id,
      inicio, fim, status, valor_centavos, usou_credito_clube, origem
    ) values (
      p_barbearia, p_barbeiro, v_cliente.id, p_servico,
      p_inicio, v_fim, v_status, v_valor, p_usar_clube, p_origem::app.origem_agendamento
    ) returning id, token_cliente into v_id, v_token;
  exception
    when exclusion_violation then
      raise exception 'horario_ocupado' using errcode = 'P0001';
  end;

  if p_usar_clube then
    insert into subscription_uses (subscription_id, appointment_id)
    values (v_assinatura.id, v_id);
  end if;

  insert into audit_log (
    barbershop_id, actor_role, acao, entidade, entidade_id, depois
  ) values (
    p_barbearia, p_origem, 'reservar', 'appointments', v_id,
    jsonb_build_object('status', v_status, 'valor_centavos', v_valor)
  );

  return jsonb_build_object(
    'id', v_id,
    'token_cliente', v_token,
    'status', v_status,
    'valor_centavos', v_valor,
    'inicio', p_inicio,
    'fim', v_fim,
    'barber_id', p_barbeiro,
    'client_id', v_cliente.id
  );
end $$;

revoke all on function public.reservar from public, anon, authenticated;

-- Devolve o slot e o crédito do clube quando alguém desiste.
create or replace function public.cancelar(
  p_agendamento uuid,
  p_por         text
) returns void
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_ag appointments%rowtype;
begin
  select * into v_ag from appointments where id = p_agendamento for update;
  if not found then
    raise exception 'agendamento_inexistente' using errcode = 'P0002';
  end if;

  if v_ag.status in ('cancelado', 'concluido', 'faltou') then
    raise exception 'agendamento_encerrado' using errcode = 'P0001';
  end if;

  update appointments
     set status = 'cancelado',
         cancelado_em = now(),
         cancelado_por = p_por
   where id = p_agendamento;

  -- O crédito volta para o ciclo: cancelar não pode custar corte.
  delete from subscription_uses where appointment_id = p_agendamento;

  update payments
     set status = 'expirado'
   where appointment_id = p_agendamento and status = 'aguardando';

  insert into audit_log (
    barbershop_id, actor_role, acao, entidade, entidade_id, antes
  ) values (
    v_ag.barbershop_id, p_por, 'cancelar', 'appointments', p_agendamento,
    jsonb_build_object('status', v_ag.status)
  );
end $$;

revoke all on function public.cancelar from public, anon, authenticated;

-- Chamada pelo cron: devolve à grade o que ficou esperando pix demais.
create or replace function public.expirar_pendentes()
returns int
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_total int := 0;
  v_linha record;
begin
  for v_linha in
    select p.id as pagamento, a.id as agendamento, a.barbershop_id,
           c.nome, c.telefone, a.inicio
      from payments p
      join appointments a on a.id = p.appointment_id
      join clients c on c.id = a.client_id
     where p.status = 'aguardando'
       and p.expira_em < now()
       and a.status = 'pendente_pagamento'
  loop
    update payments set status = 'expirado' where id = v_linha.pagamento;
    update appointments set status = 'expirado' where id = v_linha.agendamento;

    insert into notifications (
      barbershop_id, destino, template, payload, telefone
    ) values (
      v_linha.barbershop_id, 'cliente', 'pix_expirado',
      jsonb_build_object('cliente', v_linha.nome,
                         'quando', to_char(v_linha.inicio at time zone 'America/Fortaleza', 'DD/MM HH24:MI')),
      v_linha.telefone
    );

    v_total := v_total + 1;
  end loop;

  return v_total;
end $$;

revoke all on function public.expirar_pendentes from public, anon, authenticated;

-- Assinatura que passou da data entra sozinha na lista de cobrança.
create or replace function public.vencer_assinaturas()
returns int
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_total int;
begin
  update subscriptions
     set status = 'vencida'
   where status = 'ativa' and proxima_cobranca < current_date;

  get diagnostics v_total = row_count;
  return v_total;
end $$;

revoke all on function public.vencer_assinaturas from public, anon, authenticated;
