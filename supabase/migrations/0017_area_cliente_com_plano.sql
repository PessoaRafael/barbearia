-- A área do assinante passa a dizer qual plano ele tem.
--
-- Com três planos, "sua mensalidade está em dia" não basta: quem assinou só a
-- barba precisa saber que o corte dele sai pagando, e todo mundo precisa saber
-- que o benefício vale de segunda a quinta.

create or replace function public.area_do_cliente(p_chave uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  v_cliente clients%rowtype;
  v_assin   subscriptions%rowtype;
  v_casa    barbershops%rowtype;
  v_chave   access_keys%rowtype;
  v_plano   club_plans%rowtype;
begin
  select * into v_chave
    from access_keys
   where id = p_chave
     and role = 'client'
     and revogada_em is null
     and (expira_em is null or expira_em > now());

  if not found then
    raise exception 'sessao_invalida' using errcode = '28000';
  end if;

  select * into v_cliente from clients where id = v_chave.client_id;
  select * into v_casa from barbershops where id = v_chave.barbershop_id;

  select * into v_assin
    from subscriptions
   where client_id = v_cliente.id and status <> 'cancelada'
   limit 1;

  if v_assin.plan_id is not null then
    select * into v_plano from club_plans where id = v_assin.plan_id;
  end if;

  return jsonb_build_object(
    'nome', v_cliente.nome,
    'telefone', v_cliente.telefone,
    'total_cortes', v_cliente.total_cortes,
    'assinante', v_assin.id is not null
                 and v_assin.status = 'ativa'
                 and v_assin.ciclo_fim >= current_date,
    'vencida', v_assin.id is not null
               and (v_assin.status = 'vencida' or v_assin.ciclo_fim < current_date),
    'ciclo_fim', v_assin.ciclo_fim,
    'proxima_cobranca', v_assin.proxima_cobranca,
    'mensalidade', coalesce(v_assin.preco_centavos, v_casa.clube_preco_centavos),
    'ilimitado', coalesce(v_assin.cortes_mes, v_casa.clube_cortes_mes) = 0,
    'cortes_mes', coalesce(v_assin.cortes_mes, v_casa.clube_cortes_mes),

    'plano', case
               when v_plano.id is null then null::jsonb
               else jsonb_build_object(
                      'nome', v_plano.nome,
                      'categorias', to_jsonb(v_plano.cobre_categorias),
                      'dias_semana', to_jsonb(v_plano.dias_semana)
                    )
             end,

    'proximos', coalesce((
      select jsonb_agg(x order by x->>'inicio')
        from (
          select jsonb_build_object(
                   'inicio', a.inicio,
                   'servico', sv.nome,
                   'barbeiro', b.apelido,
                   'status', a.status,
                   'token', a.token_cliente,
                   'valor_centavos', a.valor_centavos
                 ) as x
            from appointments a
            join services sv on sv.id = a.service_id
            join barbers  b  on b.id  = a.barber_id
           where a.client_id = v_cliente.id
             and a.inicio >= now()
             and a.status in ('confirmado', 'pendente_pagamento')
        ) t
    ), '[]'::jsonb),

    'historico', coalesce((
      select jsonb_agg(x order by x->>'inicio' desc)
        from (
          select jsonb_build_object(
                   'inicio', a.inicio,
                   'servico', sv.nome,
                   'barbeiro', b.apelido,
                   'valor_centavos', a.valor_centavos,
                   'usou_clube', a.usou_credito_clube
                 ) as x
            from appointments a
            join services sv on sv.id = a.service_id
            join barbers  b  on b.id  = a.barber_id
           where a.client_id = v_cliente.id
             and a.status = 'concluido'
           order by a.inicio desc
           limit 10
        ) t
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.area_do_cliente from public, anon, authenticated;
