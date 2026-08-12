-- Link de pagamento: o cartão que faltava, sem esperar homologação.
--
-- A API de pedidos do PagBank segue barrada (403) esperando liberação da conta,
-- e o Checkout por API pede a mesma liberação. O Link de Pagamento, não: o
-- Johny cria no painel dele, sem integração nenhuma, e a página do PagBank
-- aceita crédito, débito e pix.
--
-- Como o link é fixo por valor, guardamos um por valor cobrado. Na hora de
-- pagar a tela procura o link daquele valor exato; se não achar, some o botão
-- e sobra o pix de sempre. Nada aqui substitui o BR Code: o pix direto cai na
-- chave do Johny na hora e sem taxa, e continua sendo o caminho principal.
--
-- Confirmação continua na mão. O PagBank não avisa a gente quando alguém paga
-- por link, então o Johny confere no app dele igual faz com o pix.

create table if not exists payment_links (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references barbershops(id) on delete cascade,
  valor_centavos int not null check (valor_centavos > 0),
  url text not null check (url like 'https://%'),
  rotulo text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  -- Um link por valor: dois links para R$ 45 seria escolher no cara ou coroa.
  unique (barbershop_id, valor_centavos)
);

create index if not exists payment_links_busca
  on payment_links (barbershop_id, valor_centavos)
  where ativo;

-- Mesmo tratamento das outras tabelas: RLS ligada e nenhuma policy, ou seja,
-- ninguém lê pela API pública. Quem consulta é o servidor com service_role.
alter table payment_links enable row level security;
