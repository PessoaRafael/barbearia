-- Aviso no celular do barbeiro.
--
-- Eles estão com a máquina na mão quando alguém marca. Som não resolve: a
-- barbearia é barulhenta e o telefone fica no bolso. Notificação do sistema
-- aparece na tela bloqueada e fica lá até alguém olhar.
--
-- Cada aparelho é uma inscrição. O mesmo barbeiro pode ter o celular e o
-- tablet do balcão, e quem sai da equipe leva junto a chave — por isso a
-- inscrição pende da chave de acesso, não da pessoa.

create table if not exists push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references barbershops(id) on delete cascade,
  -- Some junto com a chave: revogou o acesso, parou de receber aviso.
  chave_id uuid not null references access_keys(id) on delete cascade,
  barber_id uuid references barbers(id) on delete cascade,

  -- O endereço que o navegador dá para entregar o aviso. É único por
  -- aparelho: o mesmo celular reinscrito devolve o mesmo endpoint, e sem esta
  -- trava ele receberia o aviso duas vezes.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,

  criado_em timestamptz not null default now(),
  ultimo_envio timestamptz,
  -- Quantas vezes seguidas o navegador recusou. Chega no teto, a inscrição
  -- morreu: aparelho formatado, aplicativo desinstalado, permissão revogada.
  falhas int not null default 0
);

create index if not exists push_por_barbeiro
  on push_inscricoes (barbershop_id, barber_id);

alter table push_inscricoes enable row level security;
