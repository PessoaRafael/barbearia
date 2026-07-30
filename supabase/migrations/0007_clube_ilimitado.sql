-- O clube passa a ser corte ilimitado, e cobre o corte inteiro.
--
-- Zero em cortes_mes significa "sem limite". Escolhi zero em vez de um número
-- grande porque sentinela do tipo 999 sempre acaba vazando para a tela: uma
-- hora aparece "sobram 994 cortes" para o cliente.

alter table subscriptions
  drop constraint if exists subscriptions_cortes_mes_check;

update barbershops
   set clube_cortes_mes = 0
 where slug = 'johny-barbearia';

update subscriptions set cortes_mes = 0;

-- Todo corte sai de graça para o assinante. Barba e química continuam fora.
update services
   set coberto_pelo_clube = true,
       abate_centavos = preco_centavos
 where categoria = 'Cortes';

/**
 * Reserva, agora com clube ilimitado.
 *
 * A única mudança é a contagem de crédito: com cortes_mes zerado, o
 * assinante nunca esbarra em limite. O resto da validação continua igual,
 * inclusive a assinatura vencida, que segue bloqueando.
 */
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

  v_data     := (p_inicio at time zone 'America/Fortaleza')::date;
  v_hora_ini := (p_inicio at time zone 'America/Fortaleza')::time;
  v_hora_fim := (v_fim    at time zone 'America/Fortaleza')::time;
  v_dow      := extract(dow from (p_inicio at time zone 'America/Fortaleza'));

  if exists (
    select 1 from closures where barbershop_id = p_barbearia and data = v_data
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

    -- Zero em cortes_mes é ilimitado: não conta crédito nenhum.
    if v_assinatura.cortes_mes > 0 then
      select count(*) into v_usados
        from subscription_uses u
        join appointments a on a.id = u.appointment_id
       where u.subscription_id = v_assinatura.id
         and u.usado_em >= v_assinatura.ciclo_inicio
         and a.status <> 'cancelado';

      if v_usados >= v_assinatura.cortes_mes then
        raise exception 'creditos_esgotados' using errcode = 'P0001';
      end if;
    end if;

    v_valor := greatest(0, v_servico.preco_centavos - v_servico.abate_centavos);
  end if;

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
      p_inicio, v_fim, v_status, v_valor, p_usar_clube,
      p_origem::app.origem_agendamento
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
