-- Johny Barbearia â€” schema base.
-- Toda autenticaÃ§Ã£o interna sai de access_keys: nÃ£o existe e-mail nem senha.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type app.papel_acesso as enum ('owner', 'barber');
create type app.modalidade_pagamento as enum ('opcional', 'obrigatorio');
create type app.status_agendamento as enum (
  'pendente_pagamento', 'confirmado', 'concluido',
  'cancelado', 'faltou', 'expirado'
);
create type app.metodo_pagamento as enum (
  'pix', 'dinheiro', 'cartao', 'credito_clube'
);
create type app.status_pagamento as enum (
  'aguardando', 'confirmado', 'negado', 'expirado'
);
create type app.status_assinatura as enum ('ativa', 'vencida', 'cancelada');
create type app.tipo_caixa as enum ('entrada', 'saida');
create type app.destino_notificacao as enum ('cliente', 'barbeiro', 'owner');
create type app.canal_notificacao as enum ('whatsapp', 'in_app');
create type app.status_notificacao as enum (
  'pendente', 'enviada', 'falhou', 'cancelada'
);
create type app.origem_agendamento as enum ('link', 'painel');

-- ---------------------------------------------------------------------------
-- Barbearia
-- ---------------------------------------------------------------------------

create table barbershops (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  cidade text not null,
  endereco text,
  telefone text,
  logo_url text,
  pix_key text,
  pix_titular text,
  pagamento_modalidade app.modalidade_pagamento not null default 'opcional',
  reserva_minutos int not null default 15 check (reserva_minutos between 5 and 120),
  lembrete_horas int not null default 3 check (lembrete_horas between 1 and 48),
  clube_ativo boolean not null default true,
  clube_preco_centavos int not null default 9900,
  clube_cortes_mes int not null default 4,
  criado_em timestamptz not null default now()
);

create table barbers (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references barbershops(id) on delete cascade,
  nome text not null,
  apelido text not null,
  especialidade text,
  foto_url text,
  ativo boolean not null default true,
  ordem int not null default 0
);
create index on barbers (barbershop_id) where ativo;

-- A Ãºnica fonte de autenticaÃ§Ã£o interna. barber_id nulo quando role = 'owner'.
create table access_keys (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references barbershops(id) on delete cascade,
  barber_id uuid references barbers(id) on delete cascade,
  role app.papel_acesso not null,
  key_hash text not null,
  key_prefix text not null,
  criada_em timestamptz not null default now(),
  expira_em timestamptz,
  ultimo_acesso timestamptz,
  revogada_em timestamptz,
  criada_por uuid references barbers(id) on delete set null,
  constraint dono_sem_barbeiro check (
    (role = 'owner' and barber_id is null) or
    (role = 'barber' and barber_id is not null)
  )
);
create index on access_keys (barbershop_id) where revogada_em is null;

-- Tentativas de entrada, para rate limit e auditoria de forÃ§a bruta.
create table login_attempts (
  id bigserial primary key,
  ip text not null,
  key_prefix text,
  sucesso boolean not null default false,
  criado_em timestamptz not null default now()
);
create index on login_attempts (ip, criado_em desc);

-- ---------------------------------------------------------------------------
-- Expediente
-- ---------------------------------------------------------------------------

create table working_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references barbers(id) on delete cascade,
  dia_semana int not null check (dia_semana between 0 and 6),
  abre time not null,
  fecha time not null,
  ativo boolean not null default true,
  check (fecha > abre),
  unique (barber_id, dia_semana)
);

-- AlmoÃ§o fixo (dia_semana) ou bloqueio pontual (data). Um dos dois.
create table breaks (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references barbers(id) on delete cascade,
  dia_semana int check (dia_semana between 0 and 6),
  data date,
  inicio time not null,
  fim time not null,
  motivo text,
  criado_em timestamptz not null default now(),
  check (fim > inicio),
  constraint recorrente_ou_pontual check (
    (dia_semana is not null and data is null) or
    (dia_semana is null and data is not null)
  )
);
create index on breaks (barber_id, data);

create table closures (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references barbershops(id) on delete cascade,
  data date not null,
  motivo text,
  unique (barbershop_id, data)
);

-- ---------------------------------------------------------------------------
-- CatÃ¡logo
-- ---------------------------------------------------------------------------

create table services (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references barbershops(id) on delete cascade,
  nome text not null,
  categoria text not null,
  duracao_min int not null check (duracao_min > 0),
  preco_centavos int not null check (preco_centavos >= 0),
  coberto_pelo_clube boolean not null default false,
  abate_centavos int not null default 0 check (abate_centavos >= 0),
  tag text,
  ativo boolean not null default true,
  ordem int not null default 0
);
create index on services (barbershop_id) where ativo;

create table clients (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references barbershops(id) on delete cascade,
  nome text not null,
  telefone text not null,
  primeiro_corte_em timestamptz,
  ultimo_corte_em timestamptz,
  total_cortes int not null default 0,
  total_gasto_centavos int not null default 0,
  faltas int not null default 0,
  observacoes text,
  criado_em timestamptz not null default now(),
  unique (barbershop_id, telefone)
);

-- ---------------------------------------------------------------------------
-- Clube
-- ---------------------------------------------------------------------------

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references barbershops(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  status app.status_assinatura not null default 'ativa',
  preco_centavos int not null,
  cortes_mes int not null,
  ciclo_inicio date not null,
  ciclo_fim date not null,
  proxima_cobranca date not null,
  criada_em timestamptz not null default now(),
  cancelada_em timestamptz,
  check (ciclo_fim >= ciclo_inicio)
);
create unique index assinatura_viva_por_cliente
  on subscriptions (client_id) where status <> 'cancelada';

-- ---------------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------------

create table appointments (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references barbershops(id) on delete cascade,
  barber_id uuid not null references barbers(id) on delete restrict,
  client_id uuid not null references clients(id) on delete restrict,
  service_id uuid not null references services(id) on delete restrict,
  inicio timestamptz not null,
  fim timestamptz not null,
  status app.status_agendamento not null default 'confirmado',
  valor_centavos int not null default 0,
  usou_credito_clube boolean not null default false,
  origem app.origem_agendamento not null default 'link',
  token_cliente text not null unique default encode(gen_random_bytes(16), 'hex'),
  observacoes text,
  criado_em timestamptz not null default now(),
  cancelado_em timestamptz,
  cancelado_por text,
  check (fim > inicio),

  -- A trava de concorrÃªncia: dois cliques no mesmo horÃ¡rio, sÃ³ um entra.
  constraint sem_sobreposicao exclude using gist (
    barber_id with =,
    tstzrange(inicio, fim, '[)') with &&
  ) where (status in ('pendente_pagamento', 'confirmado', 'concluido'))
);
create index on appointments (barbershop_id, inicio);
create index on appointments (barber_id, inicio);
create index on appointments (client_id, inicio desc);

create table payments (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references barbershops(id) on delete cascade,
  appointment_id uuid not null references appointments(id) on delete cascade,
  metodo app.metodo_pagamento not null,
  valor_centavos int not null,
  status app.status_pagamento not null default 'aguardando',
  txid text,
  brcode text,
  expira_em timestamptz,
  confirmado_por uuid references barbers(id) on delete set null,
  confirmado_em timestamptz,
  comprovante_url text,
  criado_em timestamptz not null default now()
);
create index on payments (barbershop_id, status);
create index on payments (appointment_id);

create table subscription_uses (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  appointment_id uuid not null references appointments(id) on delete cascade,
  usado_em timestamptz not null default now(),
  unique (appointment_id)
);
create index on subscription_uses (subscription_id, usado_em desc);

create table cash_entries (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references barbershops(id) on delete cascade,
  barber_id uuid references barbers(id) on delete set null,
  tipo app.tipo_caixa not null,
  categoria text not null,
  descricao text,
  valor_centavos int not null,
  data date not null default current_date,
  appointment_id uuid references appointments(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index on cash_entries (barbershop_id, data desc);

-- Fila de espera: avisa quem quer o dia cheio quando alguÃ©m cancela.
create table waitlist (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references barbershops(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  barber_id uuid references barbers(id) on delete cascade,
  data date not null,
  criado_em timestamptz not null default now(),
  avisado_em timestamptz,
  atendido_em timestamptz
);
create index on waitlist (barbershop_id, data) where avisado_em is null;

create table notifications (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references barbershops(id) on delete cascade,
  destino app.destino_notificacao not null,
  canal app.canal_notificacao not null default 'whatsapp',
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  telefone text,
  agendada_para timestamptz not null default now(),
  enviada_em timestamptz,
  status app.status_notificacao not null default 'pendente',
  erro text,
  criado_em timestamptz not null default now()
);
create index on notifications (barbershop_id, status, agendada_para);

create table audit_log (
  id bigserial primary key,
  barbershop_id uuid not null references barbershops(id) on delete cascade,
  actor_id uuid,
  actor_role text,
  acao text not null,
  entidade text not null,
  entidade_id uuid,
  antes jsonb,
  depois jsonb,
  criado_em timestamptz not null default now()
);
create index on audit_log (barbershop_id, criado_em desc);

