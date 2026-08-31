-- Serviço que entrega mais de uma coisa.
--
-- "Máquina & tesoura + Barba" mora na categoria Cortes, mas entrega corte e
-- barba. A regra do clube olhava só a etiqueta, então o item ou saía de graça
-- para quem assina apenas corte, ou era cobrado de quem assina os dois.
--
-- Foi cobrado. Seis assinantes de "Corte + Barba ilimitado" receberam pix de
-- R$ 80 por um corte que a mensalidade deles já paga — cinco em 17/08 e o
-- Albertino de novo hoje, depois que o serviço voltou ao ar.
--
-- Desativar o item resolveu por duas semanas e voltou. Isto resolve de vez:
-- o serviço passa a declarar tudo que entrega, e o clube confere a lista
-- inteira. Com isso ele pode ficar ativo sem cobrar de quem não deve.

alter table services
  add column if not exists combina_categorias text[];

comment on column services.combina_categorias is
  'O que o serviço entrega, quando é mais de uma coisa. Nulo = só a categoria dele.';

update services
   set combina_categorias = array['Cortes', 'Barba'],
       coberto_pelo_clube = true
 where nome like '%Máquina & tesoura + Barba%';

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
      select categoria, combina_categorias, preco_centavos, abate_centavos,
             coberto_pelo_clube
        from services where id = any (v_ids)
    loop
      -- Tudo que o serviço entrega precisa caber no plano, não só a etiqueta
      -- dele. Um item chamado "Máquina & tesoura + Barba" mora na categoria
      -- Cortes, mas entrega corte E barba: olhando só a etiqueta, ou ele saía
      -- de graça para quem assina apenas corte, ou era cobrado de quem assina
      -- os dois. Foi cobrado — de seis assinantes, em duas ocasiões.
      if s.coberto_pelo_clube
         and coalesce(s.combina_categorias, array[s.categoria])
             <@ v_plano.cobre_categorias then
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
