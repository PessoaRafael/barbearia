-- Chave de acesso para o assinante do clube.
--
-- Mesmo mecanismo das chaves do Johny e dos barbeiros: o dono gera, entrega
-- por WhatsApp, e no banco fica só o hash. Muda só o papel e para quem ela
-- aponta.
--
-- Por que chave e não o telefone: o telefone de qualquer cliente é fácil de
-- adivinhar, e com ele alguém veria o histórico e os horários de outra pessoa.
-- A chave é aleatória e o Johny revoga em um clique.
--
-- Rode a 0008 antes desta: o papel 'client' precisa estar comitado para poder
-- ser escrito na constraint aqui embaixo.

alter table access_keys
  add column if not exists client_id uuid references clients(id) on delete cascade;

-- A regra antiga exigia barbeiro para tudo que não fosse dono. Agora são três
-- papéis, cada um apontando para o seu.
alter table access_keys drop constraint if exists dono_sem_barbeiro;

alter table access_keys add constraint papel_com_dono_certo check (
  (role = 'owner'  and barber_id is null and client_id is null) or
  (role = 'barber' and barber_id is not null and client_id is null) or
  (role = 'client' and barber_id is null and client_id is not null)
);

create index if not exists access_keys_cliente
  on access_keys (client_id) where revogada_em is null;
