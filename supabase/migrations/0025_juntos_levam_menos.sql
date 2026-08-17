-- Corte com barba volta a levar 45 minutos.
--
-- Existia um serviço "Máquina & tesoura + Barba" só para representar isso.
-- Era um item só, e a regra do clube é por serviço: o banco não tinha como
-- saber que ali dentro havia um corte e uma barba, então ou cobrava de todo
-- assinante, ou dava barba de graça para quem só assina corte. Cobrou — e
-- cinco assinantes de "Corte + Barba ilimitado" receberam pix de R$ 80 em
-- quatro dias. Dois perderam o horário esperando, e um chegou a pagar.
--
-- O serviço saiu do ar. A regra passa a valer para qualquer combinação, sem
-- precisar cadastrar combo nenhum, e o clube volta a acertar o preço porque
-- continua olhando serviço por serviço.
--
-- Mesma conta em lib/regras.ts, para a grade de horários oferecer encaixe do
-- tamanho certo. Aqui é onde ela vale de verdade.

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

  -- Preparo, capa, conversa e acabamento acontecem uma vez só, não uma por
  -- serviço. Corte de 30 com barba de 30 não leva uma hora: leva 45, que é o
  -- número que o Johny deu. Nunca abaixo do serviço mais longo, senão três
  -- acabamentos de 15 minutos virariam um agendamento de zero minuto em cima
  -- do próximo cliente.
  if cardinality(v_ids) > 1 then
    select greatest(
             sum(duracao_min) - (cardinality(v_ids) - 1) * 15,
             max(duracao_min)
           )
      into v_duracao
      from services
     where id = any (v_ids) and barbershop_id = p_barbearia and ativo;
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
