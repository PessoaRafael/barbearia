-- Mensalidade do clube pela InfinitePay, e o pago que perdeu o horário.
--
-- Hoje a mensalidade cai na chave do Johny e só vale quando ele confere o
-- extrato e toca em "Renovar". São uns cinquenta assinantes, quase todos
-- vencendo na mesma semana. Pela InfinitePay o pagamento confirma sozinho e o
-- ciclo anda sem ninguém conferir nada.
--
-- A tabela existe por um motivo só: o aviso da InfinitePay pode chegar mais
-- de uma vez, e a volta do cliente confere o mesmo pagamento de novo. No
-- horário, `payments.status` já diz que confirmou. Na mensalidade não tinha
-- nada, e cada aviso repetido empurraria o ciclo mais um mês. Aqui a linha
-- passa de 'aguardando' para 'paga' uma vez só.
--
-- 'pago_sem_horario': pagou depois de a reserva vencer, e outro cliente já
-- tinha pegado a cadeira. Antes isso só ia para o log da Vercel, e a tela do
-- cliente dizia "o pix não caiu no prazo" com o dinheiro dele na conta.
--
-- Rodar ANTES do push: o código novo grava os dois. Se subir antes, a
-- mensalidade não grava e o cliente cai no pix de sempre.

create table if not exists cobrancas_do_clube (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references barbershops(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  plan_id uuid not null references club_plans(id),
  valor_centavos int not null check (valor_centavos > 0),
  -- O order_nsu que vai para a InfinitePay: é por ele que o aviso acha a linha.
  pedido text not null unique,
  status text not null default 'aguardando'
    check (status in ('aguardando', 'paga')),
  -- Até quando a assinatura ficou valendo com este pagamento.
  ate date,
  criada_em timestamptz not null default now(),
  paga_em timestamptz
);

create index if not exists cobrancas_do_clube_por_cliente
  on cobrancas_do_clube (client_id, criada_em desc);

alter table cobrancas_do_clube enable row level security;

alter type app.status_pagamento add value if not exists 'pago_sem_horario';
