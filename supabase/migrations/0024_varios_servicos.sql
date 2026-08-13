-- Marcar corte e barba de uma vez.
--
-- Um cliente tentou marcar cabelo com barba e não conseguiu: dava para
-- escolher um serviço só, e ele teve que sair e entrar de novo. Fora o
-- horário, que ficava errado — a agenda reservava o tempo de um serviço só,
-- e o barbeiro levava 45 minutos num buraco de 30.
--
-- Agora `reservar` recebe uma lista. A duração é a soma, e o preço também.
--
-- No clube, cada serviço é conferido separado contra o plano: o que o plano
-- cobre sai zerado, o que não cobre é cobrado normalmente. Assim quem tem
-- "Corte ilimitado" e pede corte com barba paga só a barba — que é
-- exatamente o que o Johny vende. Antes isso nem existia: pedir algo fora do
-- plano derrubava a reserva inteira.
--
-- `appointments.service_id` continua apontando para o serviço mais caro. Todas
-- as telas que já existem leem esse campo e seguem funcionando; os demais
-- ficam em `appointment_services`.

create table if not exists appointment_services (
  appointment_id uuid not null references appointments(id) on delete cascade,
  service_id uuid not null references services(id),
  -- Congelados no momento da reserva: mudar o preço do serviço depois não
  -- pode reescrever o que já foi cobrado de alguém.
  preco_centavos int not null,
  duracao_min int not null,
  primary key (appointment_id, service_id)
);

alter table appointment_services enable row level security;

-- A assinatura antiga sai de cena: manter as duas viraria sobrecarga, e o
-- PostgREST escolheria uma delas por conta própria.
drop function if exists public.reservar(
  uuid, uuid, uuid, text, text, timestamptz, boolean, text
);

create or replace function public.reservar(
  p_barbearia   uuid,
  p_barbeiro    uuid,
  p_servicos    uuid[],
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
  v_casa       barbershops%rowtype;
  v_cliente    clients%rowtype;
  v_assinatura subscriptions%rowtype;
  v_plano      club_plans%rowtype;
  v_ids        uuid[];
  v_principal  uuid;
  v_duracao    int;
  v_fim        timestamptz;
  v_dow        int;
  v_hora_ini   time;
  v_hora_fim   time;
  v_data       date;
  v_valor      int;
  v_cobertos   int;
  v_status     app.status_agendamento;
  v_usados     int;
  v_id         uuid;
  v_token      text;
  s            record;
begin
  select * into v_casa from barbershops where id = p_barbearia;
  if not found then
    raise exception 'barbearia_inexistente' using errcode = 'P0002';
  end if;

  -- Repetido não soma duas vezes, e a lista vazia não vira agendamento de
  -- zero minuto em cima de outro cliente.
  select array_agg(distinct x) into v_ids from unnest(p_servicos) as x;

  if v_ids is null or cardinality(v_ids) = 0 then
    raise exception 'servico_indisponivel' using errcode = 'P0002';
  end if;

  -- Teto para não existir agendamento de três horas por engano na tela.
  if cardinality(v_ids) > 4 then
    raise exception 'servicos_demais' using errcode = 'P0001';
  end if;

  select sum(duracao_min) into v_duracao
    from services
   where id = any (v_ids) and barbershop_id = p_barbearia and ativo;

  -- Um id inválido, de outra casa ou desativado some da conta: se sumiu
  -- algum, a lista não era válida.
  if v_duracao is null or (
    select count(*) from services
     where id = any (v_ids) and barbershop_id = p_barbearia and ativo
  ) <> cardinality(v_ids) then
    raise exception 'servico_indisponivel' using errcode = 'P0002';
  end if;

  select id into v_principal
    from services
   where id = any (v_ids)
   order by preco_centavos desc, duracao_min desc, id
   limit 1;

  if p_inicio <= now() then
    raise exception 'horario_no_passado' using errcode = 'P0001';
  end if;

  v_fim := p_inicio + make_interval(mins => v_duracao);

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

  -- A trava do dia, para quem é do clube. Fora do `if p_usar_clube` de
  -- propósito: senão bastava desmarcar a opção do clube para furar.
  select * into v_assinatura
    from subscriptions
   where client_id = v_cliente.id
     and status = 'ativa'
     and ciclo_fim >= current_date
   limit 1;

  if found and v_assinatura.plan_id is not null then
    select * into v_plano from club_plans where id = v_assinatura.plan_id;

    if found and not (v_dow = any (v_plano.dias_semana)) then
      raise exception 'dia_fora_do_clube' using errcode = 'P0001';
    end if;
  end if;

  select coalesce(sum(preco_centavos), 0) into v_valor
    from services where id = any (v_ids);

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

    select * into v_plano from club_plans where id = v_assinatura.plan_id;
    if not found then
      raise exception 'plano_inexistente' using errcode = 'P0002';
    end if;

    -- Serviço a serviço: o que o plano cobre sai pelo valor com abate, o
    -- resto continua valendo o preço cheio.
    v_valor := 0;
    v_cobertos := 0;

    for s in
      select categoria, preco_centavos, abate_centavos, coberto_pelo_clube
        from services where id = any (v_ids)
    loop
      if s.categoria = any (v_plano.cobre_categorias) and s.coberto_pelo_clube then
        v_cobertos := v_cobertos + 1;
        v_valor := v_valor + greatest(0, s.preco_centavos - s.abate_centavos);
      else
        v_valor := v_valor + s.preco_centavos;
      end if;
    end loop;

    -- Marcar "pelo clube" sem nada coberto seria gastar crédito à toa.
    if v_cobertos = 0 then
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
      p_barbearia, p_barbeiro, v_cliente.id, v_principal,
      p_inicio, v_fim, v_status, v_valor, p_usar_clube,
      p_origem::app.origem_agendamento
    ) returning id, token_cliente into v_id, v_token;
  exception
    when exclusion_violation then
      raise exception 'horario_ocupado' using errcode = 'P0001';
  end;

  insert into appointment_services (
    appointment_id, service_id, preco_centavos, duracao_min
  )
  select v_id, id, preco_centavos, duracao_min
    from services where id = any (v_ids);

  if p_usar_clube then
    insert into subscription_uses (subscription_id, appointment_id)
    values (v_assinatura.id, v_id);
  end if;

  insert into audit_log (
    barbershop_id, actor_role, acao, entidade, entidade_id, depois
  ) values (
    p_barbearia, p_origem, 'reservar', 'appointments', v_id,
    jsonb_build_object(
      'status', v_status,
      'valor_centavos', v_valor,
      'servicos', v_ids
    )
  );

  return jsonb_build_object(
    'id', v_id,
    'token_cliente', v_token,
    'status', v_status,
    'valor_centavos', v_valor,
    'inicio', p_inicio,
    'fim', v_fim,
    'duracao_min', v_duracao,
    'barber_id', p_barbeiro,
    'client_id', v_cliente.id
  );
end $$;

revoke all on function public.reservar from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- A agenda do Johny precisa dizer que tem barba junto.
--
-- Mesma função de 0012, com duas mudanças: o nome do serviço vira a lista de
-- tudo que foi marcado naquele horário, e a duração passa a ser a do bloco em
-- vez da do serviço principal.
create or replace function public.painel_agenda(p_chave uuid, p_data date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  s app.sessao;
  v_escopo uuid;
  v_dow int;
begin
  s := app.resolver(p_chave);
  v_escopo := case when s.papel = 'barber' then s.barbeiro_id else null end;
  v_dow := extract(dow from p_data);

  return jsonb_build_object(
    'marcados', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', a.id,
                 'barber_id', a.barber_id,
                 'barbeiro', b.apelido,
                 'inicio', a.inicio,
                 'fim', a.fim,
                 'status', a.status,
                 'valor_centavos', a.valor_centavos,
                 'usou_credito_clube', a.usou_credito_clube,
                 'cliente', c.nome,
                 'telefone', c.telefone,
                 'assinante', exists (
                   select 1 from subscriptions sub
                    where sub.client_id = c.id and sub.status = 'ativa'
                 ),
                 -- Corte + Barba na mesma linha. O fallback em sv.nome
                 -- cobre o que foi marcado antes de existir carrinho.
                 'servico', coalesce((
                   select string_agg(x.nome, ' + ' order by x.preco_centavos desc)
                     from appointment_services aps
                     join services x on x.id = aps.service_id
                    where aps.appointment_id = a.id
                 ), sv.nome),
                 -- Duração real do bloco, não a do serviço principal: com dois
                 -- serviços o cartão na agenda saía menor do que o horário
                 -- que ele ocupa de verdade.
                 'duracao_min', (extract(epoch from (a.fim - a.inicio)) / 60)::int
               ) order by a.inicio
             )
        from appointments a
        join barbers  b  on b.id  = a.barber_id
        join clients  c  on c.id  = a.client_id
        join services sv on sv.id = a.service_id
       where a.barbershop_id = s.barbearia_id
         and (v_escopo is null or a.barber_id = v_escopo)
         and a.inicio >= (p_data::text || ' 00:00')::timestamp
                         at time zone 'America/Fortaleza'
         and a.inicio <  ((p_data + 1)::text || ' 00:00')::timestamp
                         at time zone 'America/Fortaleza'
         and a.status <> 'expirado'
    ), '[]'::jsonb),

    -- Só os pontuais: o almoço fixo mora em dia_semana e não se solta daqui.
    'bloqueios', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', k.id,
                 'barber_id', k.barber_id,
                 'inicio', k.inicio,
                 'fim', k.fim,
                 'motivo', k.motivo
               ) order by k.inicio
             )
        from breaks k
        join barbers b on b.id = k.barber_id
       where b.barbershop_id = s.barbearia_id
         and (v_escopo is null or k.barber_id = v_escopo)
         and k.data = p_data
    ), '[]'::jsonb),

    'barbeiros', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', b.id, 'apelido', b.apelido)
               order by b.ordem
             )
        from barbers b
       where b.barbershop_id = s.barbearia_id
         and b.ativo
         and (v_escopo is null or b.id = v_escopo)
    ), '[]'::jsonb),

    -- O mais cedo que alguém abre e o mais tarde que alguém fecha nesse dia.
    -- null quando ninguém trabalha, e aí não há o que fechar.
    -- left(...::text, 5) e não to_char: não existe to_char para o tipo time,
    -- e o cast implícito para interval é justamente o tipo de detalhe que só
    -- aparece em produção.
    'janela', (
      select case
               when count(*) = 0 then null::jsonb
               else jsonb_build_object(
                      'abre', left(min(w.abre)::text, 5),
                      'fecha', left(max(w.fecha)::text, 5)
                    )
             end
        from working_hours w
        join barbers b on b.id = w.barber_id
       where b.barbershop_id = s.barbearia_id
         and b.ativo
         and (v_escopo is null or b.id = v_escopo)
         and w.dia_semana = v_dow
         and w.ativo
    )
  );
end $$;

revoke all on function public.painel_agenda from public, anon, authenticated;
