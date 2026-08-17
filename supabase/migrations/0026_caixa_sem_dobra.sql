-- O caixa estava contando o mesmo dinheiro duas vezes.
--
-- Confirmar o pix lança uma entrada. Encerrar o atendimento lança outra. Como
-- quase todo mundo paga e depois é encerrado, cada atendimento pago entrava
-- duas vezes — e dois deles, três, porque encerrar foi chamado de novo.
--
-- Em uma semana isso inflou o caixa em R$ 730 sobre R$ 1.755 lançados: o
-- Johny estava lendo quase o dobro do que entrou. Os lançamentos repetidos já
-- foram apagados; isto impede que voltem.
--
-- Duas travas, de propósito. As funções passam a olhar antes de lançar, que é
-- o conserto de verdade; e um índice único garante que nenhum caminho novo
-- consiga criar a segunda entrada, inclusive o pix automático da 0020.

create or replace function public.encerrar_atendimento(
  p_chave       uuid,
  p_agendamento uuid,
  p_status      text
)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
declare
  s app.sessao;
  v_ag appointments%rowtype;
begin
  s := app.resolver(p_chave);

  if p_status not in ('concluido', 'faltou') then
    raise exception 'status_invalido' using errcode = 'P0001';
  end if;

  select * into v_ag from appointments where id = p_agendamento for update;
  if not found or v_ag.barbershop_id <> s.barbearia_id then
    raise exception 'agendamento_inexistente' using errcode = 'P0002';
  end if;

  if s.papel = 'barber' and v_ag.barber_id <> s.barbeiro_id then
    raise exception 'nao_e_sua_agenda' using errcode = '42501';
  end if;

  update appointments
     set status = p_status::app.status_agendamento
   where id = p_agendamento;

  if p_status = 'concluido' then
    update clients
       set total_cortes = total_cortes + 1,
           total_gasto_centavos = total_gasto_centavos + v_ag.valor_centavos,
           ultimo_corte_em = now(),
           primeiro_corte_em = coalesce(primeiro_corte_em, now())
     where id = v_ag.client_id;

    -- Só lança se ninguém lançou antes por este atendimento. O pix
    -- confirmado já cria a entrada, e encerrar depois criava a segunda: o
    -- mesmo dinheiro entrava duas vezes no caixa. Foram R$ 730 a mais em uma
    -- semana, com dois atendimentos chegando a contar três vezes porque
    -- encerrar foi chamado de novo.
    if v_ag.valor_centavos > 0 and not exists (
      select 1 from cash_entries where appointment_id = v_ag.id
    ) then
      insert into cash_entries (
        barbershop_id, barber_id, tipo, categoria, descricao,
        valor_centavos, appointment_id
      ) values (
        v_ag.barbershop_id, v_ag.barber_id, 'entrada', 'atendimento',
        'corte concluído', v_ag.valor_centavos, v_ag.id
      );
    end if;
  else
    update clients set faltas = faltas + 1 where id = v_ag.client_id;
  end if;

  insert into audit_log (
    barbershop_id, actor_id, actor_role, acao, entidade, entidade_id, antes, depois
  ) values (
    s.barbearia_id, s.barbeiro_id, s.papel::text, 'encerrar', 'appointments',
    p_agendamento,
    jsonb_build_object('status', v_ag.status),
    jsonb_build_object('status', p_status)
  );
end $$;

/** Bloqueio pontual: o barbeiro fecha um pedaço do próprio dia. */

create or replace function public.decidir_pix(
  p_chave     uuid,
  p_pagamento uuid,
  p_recebido  boolean
)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
declare
  s app.sessao;
  v_pg payments%rowtype;
  v_ag appointments%rowtype;
  v_cliente clients%rowtype;
begin
  s := app.exigir_dono(p_chave);

  select * into v_pg from payments where id = p_pagamento for update;
  if not found or v_pg.barbershop_id <> s.barbearia_id then
    raise exception 'pagamento_inexistente' using errcode = 'P0002';
  end if;

  select * into v_ag from appointments where id = v_pg.appointment_id for update;
  select * into v_cliente from clients where id = v_ag.client_id;

  if p_recebido then
    update payments
       set status = 'confirmado', confirmado_em = now(), confirmado_por = s.barbeiro_id
     where id = p_pagamento;

    update appointments set status = 'confirmado' where id = v_ag.id;

    -- Mesmo cuidado do outro lado: se o atendimento já foi encerrado e
    -- lançou, confirmar o pix depois não pode lançar de novo.
    if not exists (select 1 from cash_entries where appointment_id = v_ag.id) then
      insert into cash_entries (
        barbershop_id, barber_id, tipo, categoria, descricao,
        valor_centavos, appointment_id
      ) values (
        s.barbearia_id, v_ag.barber_id, 'entrada', 'pix',
        'pix confirmado', v_pg.valor_centavos, v_ag.id
      );
    end if;

    insert into notifications (barbershop_id, destino, template, payload, telefone)
    values (
      s.barbearia_id, 'cliente', 'pix_confirmado',
      jsonb_build_object(
        'cliente', split_part(v_cliente.nome, ' ', 1),
        'quando', to_char(v_ag.inicio at time zone 'America/Fortaleza', 'DD/MM HH24:MI')
      ),
      v_cliente.telefone
    );
  else
    update payments set status = 'negado' where id = p_pagamento;
    perform public.cancelar(v_ag.id, 'owner');
  end if;

  insert into audit_log (
    barbershop_id, actor_id, actor_role, acao, entidade, entidade_id, depois
  ) values (
    s.barbearia_id, s.barbeiro_id, 'owner', 'decidir_pix', 'payments',
    p_pagamento, jsonb_build_object('recebido', p_recebido)
  );
end $$;


create or replace function public.confirmar_pix(p_txid text)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_pg      payments%rowtype;
  v_ag      appointments%rowtype;
  v_cliente clients%rowtype;
begin
  select * into v_pg from payments where txid = p_txid for update;
  if not found then
    raise exception 'pagamento_inexistente' using errcode = 'P0002';
  end if;

  -- Já confirmado: sai quieto. Reenvio de notificação é normal, e lançar o
  -- caixa duas vezes faria o Johny caçar dinheiro que nunca entrou.
  if v_pg.status = 'confirmado' then
    return jsonb_build_object('ja_estava', true, 'agendamento', v_pg.appointment_id);
  end if;

  select * into v_ag from appointments where id = v_pg.appointment_id for update;
  select * into v_cliente from clients where id = v_ag.client_id;

  update payments
     set status = 'confirmado', confirmado_em = now()
   where id = v_pg.id;

  update appointments set status = 'confirmado' where id = v_ag.id;

  -- Mesma trava dos outros dois caminhos. Sem ela, um atendimento já
  -- encerrado receberia a segunda entrada e o índice único derrubaria a
  -- confirmação inteira — o cliente pagaria e o horário não confirmaria.
  if not exists (select 1 from cash_entries where appointment_id = v_ag.id) then
    insert into cash_entries (
      barbershop_id, barber_id, tipo, categoria, descricao,
      valor_centavos, appointment_id
    ) values (
      v_pg.barbershop_id, v_ag.barber_id, 'entrada', 'pix',
      'pix confirmado automaticamente', v_pg.valor_centavos, v_ag.id
    );
  end if;

  insert into notifications (barbershop_id, destino, template, payload, telefone)
  values (
    v_pg.barbershop_id, 'cliente', 'pix_confirmado',
    jsonb_build_object(
      'cliente', split_part(v_cliente.nome, ' ', 1),
      'quando', to_char(v_ag.inicio at time zone 'America/Fortaleza', 'DD/MM HH24:MI')
    ),
    v_cliente.telefone
  );

  insert into audit_log (
    barbershop_id, actor_role, acao, entidade, entidade_id, depois
  ) values (
    v_pg.barbershop_id, 'link', 'confirmar_pix', 'payments', v_pg.id,
    jsonb_build_object('txid', p_txid, 'automatico', true)
  );

  return jsonb_build_object('ja_estava', false, 'agendamento', v_ag.id);
end $$;


revoke all on function public.confirmar_pix from public, anon, authenticated;

-- Rede de segurança: um lançamento por atendimento, no banco. Lançamento
-- avulso (compra, despesa, acerto) não tem appointment_id e não entra aqui.
create unique index if not exists caixa_um_por_atendimento
  on cash_entries (appointment_id)
  where appointment_id is not null;

revoke all on function public.encerrar_atendimento from public, anon, authenticated;
revoke all on function public.decidir_pix from public, anon, authenticated;
