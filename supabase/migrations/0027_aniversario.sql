-- Aniversário do assinante.
--
-- Quem é do clube volta toda semana, e o Johny conhece essa gente pelo nome.
-- Faltava a data: sem ela não dá para lembrar de ninguém, nem para separar os
-- do mês se ele quiser fazer alguma cortesia.
--
-- Quem preenche é o próprio cliente, na área dele. Pedir no agendamento seria
-- mais um campo entre a pessoa e a cadeira, e para quem só corta uma vez a
-- data não serve para nada. Fica opcional: nada trava sem ela.

alter table clients
  add column if not exists nascimento date;

-- Só o dia e o mês interessam. O ano vem junto porque a data é uma só, mas
-- ninguém no sistema calcula idade com isso.
create index if not exists clientes_aniversario
  on clients ((extract(month from nascimento)), (extract(day from nascimento)))
  where nascimento is not null;

/**
 * O próprio assinante guardando a data dele.
 *
 * A chave é a identidade: ela diz de qual cliente é a área aberta, então não
 * há como alguém escrever no cadastro de outro mandando outro id.
 */
create or replace function public.salvar_nascimento(p_chave uuid, p_data date)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_chave access_keys%rowtype;
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

  -- Data no futuro é engano de digitação, e 1900 também. Guardar lixo aqui
  -- faria a lista de aniversariantes do mês nascer errada.
  if p_data is not null
     and (p_data > current_date or p_data < date '1900-01-01') then
    raise exception 'data_invalida' using errcode = 'P0001';
  end if;

  update clients set nascimento = p_data where id = v_chave.client_id;
end $$;

revoke all on function public.salvar_nascimento from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- A área do assinante passa a devolver a data, para a tela mostrar o que ele
-- já preencheu em vez de pedir de novo.

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
    'nascimento', v_cliente.nascimento,
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
