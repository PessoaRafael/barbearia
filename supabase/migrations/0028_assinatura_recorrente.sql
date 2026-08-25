-- Assinatura que se cobra sozinha.
--
-- Hoje o Johny persegue 49 pessoas por mês para receber R$ 129,99 de cada uma.
-- Com recorrência, o cartão é cobrado sozinho a cada 30 dias e ele não fala
-- mais sobre dinheiro com quem assina — só corta.
--
-- Vale só para quem assinar daqui em diante. Ninguém migra sozinho: quem está
-- no pix continua no pix até decidir trocar, e as duas formas convivem.

/**
 * O vínculo com a Stripe fica na assinatura, não numa tabela nova.
 *
 * `stripe_subscription_id` é quem manda: enquanto ele existir, o ciclo é
 * empurrado pelo webhook a cada fatura paga, e o Johny não deve mexer no
 * "Recebi" daquela pessoa — o dinheiro entra sem ele.
 */
alter table subscriptions
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id text,
  -- Quando ele pediu para não renovar. A assinatura segue ativa até o fim do
  -- ciclo pago: cortar no dia do clique seria ficar com dinheiro dele.
  add column if not exists cancela_no_fim boolean not null default false;

create unique index if not exists assinatura_por_stripe
  on subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- O preço recorrente que representa cada plano lá na Stripe. Sem isto, o
-- checkout teria que adivinhar qual cobrar.
alter table club_plans
  add column if not exists stripe_price_id text;

/**
 * Renovação vinda do webhook.
 *
 * Chamada quando uma fatura é paga: empurra o ciclo pelos dias do plano e
 * garante que a assinatura volte a valer, mesmo que estivesse vencida por
 * falha de cartão no mês anterior.
 *
 * Idempotente pelo período: reenvio do mesmo aviso não empilha 30 dias em
 * cima de 30 dias. A Stripe reenvia webhook por dias quando algo falha, e sem
 * isto alguém ganharia meses de clube de graça por causa de uma instabilidade.
 */
create or replace function public.renovar_assinatura(
  p_stripe_id text,
  p_ate       date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_assin subscriptions%rowtype;
  v_plano club_plans%rowtype;
  v_fim   date;
begin
  select * into v_assin
    from subscriptions
   where stripe_subscription_id = p_stripe_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'assinatura_desconhecida');
  end if;

  select * into v_plano from club_plans where id = v_assin.plan_id;

  -- A Stripe manda até quando o período vale. Confiamos nela quando vem, e
  -- caímos nos dias do plano quando não vem.
  v_fim := coalesce(
    p_ate,
    current_date + coalesce(v_plano.duracao_dias, 30)
  );

  -- Já estava valendo até essa data ou depois: nada a fazer.
  if v_assin.ciclo_fim >= v_fim then
    return jsonb_build_object('ok', true, 'ja_estava', true, 'ate', v_assin.ciclo_fim);
  end if;

  update subscriptions
     set status = 'ativa',
         ciclo_inicio = current_date,
         ciclo_fim = v_fim,
         proxima_cobranca = v_fim
   where id = v_assin.id;

  return jsonb_build_object('ok', true, 'ja_estava', false, 'ate', v_fim);
end $$;

/**
 * Cartão falhou.
 *
 * Não cancela: marca vencida. A Stripe ainda vai tentar de novo nos próximos
 * dias, e cancelar na primeira falha tiraria o clube de quem só trocou de
 * cartão. Quem está vencido paga o corte no valor normal até acertar, que é a
 * regra que já existia para o pix atrasado.
 */
create or replace function public.falhou_cobranca(p_stripe_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_id uuid;
begin
  update subscriptions
     set status = 'vencida'
   where stripe_subscription_id = p_stripe_id
     and status <> 'cancelada'
   returning id into v_id;

  return jsonb_build_object('ok', v_id is not null);
end $$;

/**
 * Assinatura encerrada de vez, do lado da Stripe.
 *
 * Chega quando o cliente cancelou e o período pago acabou, ou quando a Stripe
 * desistiu depois de tentar cobrar várias vezes.
 */
create or replace function public.encerrar_assinatura(p_stripe_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_id uuid;
begin
  update subscriptions
     set status = 'cancelada',
         cancelada_em = now(),
         cancela_no_fim = false
   where stripe_subscription_id = p_stripe_id
     and status <> 'cancelada'
   returning id into v_id;

  return jsonb_build_object('ok', v_id is not null);
end $$;

revoke all on function public.renovar_assinatura  from public, anon, authenticated;
revoke all on function public.falhou_cobranca     from public, anon, authenticated;
revoke all on function public.encerrar_assinatura from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- A área do assinante precisa saber se a cobrança é automática: quem paga no
-- cartão não deve ler "avise o Johny quando pagar".

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
    -- Recorrente: o cartão é cobrado sozinho, então a tela mostra "renova em"
    -- em vez de "avise o Johny quando pagar".
    'recorrente', v_assin.stripe_subscription_id is not null,
    'cancela_no_fim', coalesce(v_assin.cancela_no_fim, false),
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
