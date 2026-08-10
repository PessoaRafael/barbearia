-- Funções da área do assinante.
--
-- Ficam num arquivo separado da 0008 porque o Postgres não deixa usar um valor
-- de enum recém-criado na mesma transação em que ele foi adicionado.

/**
 * Gera a chave de um assinante. Uma viva por pessoa: gerar de novo derruba a
 * anterior, igual à do barbeiro.
 */
create or replace function public.criar_chave_cliente(
  p_chave   uuid,
  p_cliente uuid,
  p_hash    text,
  p_prefixo text
)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  s app.sessao;
  v_id uuid;
begin
  s := app.exigir_dono(p_chave);

  if not exists (
    select 1 from clients where id = p_cliente and barbershop_id = s.barbearia_id
  ) then
    raise exception 'cliente_de_outra_casa' using errcode = '42501';
  end if;

  update access_keys
     set revogada_em = now()
   where client_id = p_cliente and revogada_em is null;

  insert into access_keys (
    barbershop_id, client_id, role, key_hash, key_prefix, criada_por
  ) values (
    s.barbearia_id, p_cliente, 'client', p_hash, p_prefixo, s.barbeiro_id
  ) returning id into v_id;

  insert into audit_log (
    barbershop_id, actor_role, acao, entidade, entidade_id
  ) values (s.barbearia_id, 'owner', 'criar_chave_cliente', 'access_keys', v_id);

  return v_id;
end $$;

/**
 * Tudo que a área do assinante mostra, numa consulta só: quem ele é, se a
 * mensalidade está em dia, os próximos horários e o histórico.
 *
 * Recebe o id da chave, nunca o id do cliente: assim ninguém vê a área de
 * outra pessoa trocando um número na URL.
 */
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

revoke all on function public.criar_chave_cliente from public, anon, authenticated;
revoke all on function public.area_do_cliente     from public, anon, authenticated;
