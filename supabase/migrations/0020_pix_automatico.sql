-- Confirmação de pix sem passar pela mão do Johny.
--
-- Mesmo efeito do "Recebi" do painel — libera o horário, lança no caixa e
-- enfileira o aviso — só que disparado pelo provedor de pagamento em vez de
-- por uma pessoa. Vale a função separada porque `decidir_pix` exige chave de
-- dono, e aqui não existe dono nenhum clicando.
--
-- Quem chama é a rota de webhook, e só depois de PERGUNTAR ao PagBank se o
-- pagamento existe mesmo. O corpo que chega pela internet nunca decide nada.
--
-- Idempotente de propósito: provedor de pagamento reenvia notificação, e a
-- segunda não pode lançar o valor no caixa de novo.

alter table clients
  add column if not exists email text,
  add column if not exists cpf text;

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

  insert into cash_entries (
    barbershop_id, barber_id, tipo, categoria, descricao,
    valor_centavos, appointment_id
  ) values (
    v_pg.barbershop_id, v_ag.barber_id, 'entrada', 'pix',
    'pix confirmado automaticamente', v_pg.valor_centavos, v_ag.id
  );

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
