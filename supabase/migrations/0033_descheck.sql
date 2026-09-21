-- Desfazer o check do pagamento.
--
-- O painel tem três botões que mexem em dinheiro com um toque só: "Concluir",
-- que lança o corte no caixa; "Recebi", que confirma o pix; e "Não caiu", que
-- além de negar o pix cancela o horário do cliente. Nenhum deles tinha volta.
--
-- Já custou caro. O Iuri escolheu cartão, largou o pix pendente, o Johny
-- clicou em "não recebi" e o cliente perdeu a cadeira — e a única forma de
-- devolver foi mexer no banco na mão. Botão de desfazer é mais barato que
-- isso, e o Johny opera essa tela com a máquina na outra mão.
--
-- Duas regras que valem para as duas funções:
--
--   1. Só desfaz o que este sistema lançou por causa daquele clique. Entrada
--      de pix confirmado não some porque alguém desfez o encerramento: aquele
--      dinheiro caiu de verdade.
--   2. Devolver alguém à grade pode esbarrar em quem ocupou o lugar. Aí a
--      função recusa e diz isso, em vez de derrubar o agendamento de outro.

/**
 * Desfaz "Concluir" ou "Faltou".
 *
 * Devolve o atendimento ao status que tinha antes — que sai do audit_log, não
 * de chute: encerrar já grava o `antes`, e nem todo encerrado vinha de
 * 'confirmado'.
 *
 * Só o dono. Encerrar é do barbeiro, que fecha o próprio corte; desfazer tira
 * dinheiro do caixa, e caixa não aparece na tela deles.
 */
create or replace function public.desfazer_encerramento(
  p_chave       uuid,
  p_agendamento uuid
)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
declare
  s app.sessao;
  v_ag     appointments%rowtype;
  v_antes  text;
  v_ultimo timestamptz;
begin
  s := app.exigir_dono(p_chave);

  select * into v_ag from appointments where id = p_agendamento for update;
  if not found or v_ag.barbershop_id <> s.barbearia_id then
    raise exception 'agendamento_inexistente' using errcode = 'P0002';
  end if;

  if v_ag.status not in ('concluido', 'faltou') then
    raise exception 'nao_encerrado' using errcode = 'P0001';
  end if;

  select antes->>'status'
    into v_antes
    from audit_log
   where entidade = 'appointments'
     and entidade_id = p_agendamento
     and acao = 'encerrar'
   order by criado_em desc
   limit 1;

  -- Encerramento antigo, de antes do log: 'confirmado' é o único estado de
  -- onde se conclui um corte na prática.
  v_antes := coalesce(v_antes, 'confirmado');

  if v_ag.status = 'concluido' then
    /**
     * Desfaz o que o encerramento somou na ficha do cliente.
     *
     * `greatest(..., 0)` porque esses contadores vêm de antes do sistema e já
     * foram acertados na mão: nenhum desfazer pode deixar o cliente com -1
     * corte na ficha.
     */
    select max(inicio)
      into v_ultimo
      from appointments
     where client_id = v_ag.client_id
       and status = 'concluido'
       and id <> v_ag.id;

    update clients
       set total_cortes = greatest(total_cortes - 1, 0),
           total_gasto_centavos =
             greatest(total_gasto_centavos - v_ag.valor_centavos, 0),
           ultimo_corte_em = v_ultimo
     where id = v_ag.client_id;

    /**
     * Tira do caixa só o lançamento que o encerramento criou.
     *
     * Se a entrada daquele atendimento é de pix, ela veio de dinheiro que
     * caiu na conta e fica onde está: some o corte da régua, não o que o
     * cliente pagou.
     */
    delete from cash_entries
     where appointment_id = v_ag.id
       and categoria = 'atendimento';
  else
    update clients
       set faltas = greatest(faltas - 1, 0)
     where id = v_ag.client_id;
  end if;

  /**
   * Voltar para 'confirmado' devolve o horário à trava de sobreposição. Se
   * alguém pegou o lugar enquanto isso, a trava estoura — e é melhor recusar
   * com nome do que desmarcar o outro cliente sem avisar.
   */
  begin
    update appointments
       set status = v_antes::app.status_agendamento
     where id = p_agendamento;
  exception when exclusion_violation then
    raise exception 'horario_ocupado' using errcode = 'P0001';
  end;

  insert into audit_log (
    barbershop_id, actor_id, actor_role, acao, entidade, entidade_id,
    antes, depois
  ) values (
    s.barbearia_id, s.barbeiro_id, 'owner', 'desfazer_encerrar',
    'appointments', p_agendamento,
    jsonb_build_object('status', v_ag.status),
    jsonb_build_object('status', v_antes)
  );
end $$;


/**
 * Desfaz "Recebi" ou "Não caiu" do pix.
 *
 * Volta o pagamento a aguardando. No "Recebi", tira do caixa a entrada que
 * aquele clique criou; no "Não caiu", devolve o horário ao cliente, com o
 * crédito do clube de volta se o corte era pelo plano.
 */
create or replace function public.desfazer_pix(
  p_chave     uuid,
  p_pagamento uuid
)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
declare
  s app.sessao;
  v_pg    payments%rowtype;
  v_ag    appointments%rowtype;
  v_assin uuid;
begin
  s := app.exigir_dono(p_chave);

  select * into v_pg from payments where id = p_pagamento for update;
  if not found or v_pg.barbershop_id <> s.barbearia_id then
    raise exception 'pagamento_inexistente' using errcode = 'P0002';
  end if;

  if v_pg.status not in ('confirmado', 'negado') then
    raise exception 'nada_a_desfazer' using errcode = 'P0001';
  end if;

  select * into v_ag from appointments where id = v_pg.appointment_id for update;

  -- Atendimento já encerrado embaralha as duas contas: o corte entrou na
  -- ficha do cliente e o caixa pode ter lançamento dos dois lados. Desfaz o
  -- encerramento primeiro, depois o pix.
  if v_ag.status in ('concluido', 'faltou') then
    raise exception 'atendimento_encerrado' using errcode = 'P0001';
  end if;

  update payments
     set status = 'aguardando',
         confirmado_em = null,
         confirmado_por = null
   where id = p_pagamento;

  if v_pg.status = 'confirmado' then
    delete from cash_entries
     where appointment_id = v_ag.id
       and categoria = 'pix';

    update appointments
       set status = 'pendente_pagamento'
     where id = v_ag.id;
  else
    /**
     * "Não caiu" cancelou o horário. Devolver é reabrir a mesma linha, e a
     * trava de sobreposição decide se ainda dá: quinze minutos depois o lugar
     * pode ser de outra pessoa.
     */
    begin
      update appointments
         set status = 'pendente_pagamento',
             cancelado_em = null,
             cancelado_por = null
       where id = v_ag.id;
    exception when exclusion_violation then
      raise exception 'horario_ocupado' using errcode = 'P0001';
    end;

    -- O cancelamento devolveu o crédito ao ciclo; reabrir tem que gastar de
    -- novo, senão o assinante ganha um corte a mais de graça.
    if v_ag.usou_credito_clube then
      select id into v_assin
        from subscriptions
       where client_id = v_ag.client_id
         and status <> 'cancelada'
       limit 1;

      if v_assin is not null then
        insert into subscription_uses (subscription_id, appointment_id)
        values (v_assin, v_ag.id)
        on conflict (appointment_id) do nothing;
      end if;
    end if;
  end if;

  insert into audit_log (
    barbershop_id, actor_id, actor_role, acao, entidade, entidade_id,
    antes, depois
  ) values (
    s.barbearia_id, s.barbeiro_id, 'owner', 'desfazer_pix', 'payments',
    p_pagamento,
    jsonb_build_object('status', v_pg.status),
    jsonb_build_object('status', 'aguardando')
  );
end $$;

revoke all on function public.desfazer_encerramento from public, anon, authenticated;
revoke all on function public.desfazer_pix from public, anon, authenticated;
