-- O clube deixa de ser um plano só.
--
-- O Johny fechou três, todos ilimitados, todos de segunda a quinta:
--
--   Corte ilimitado           R$ 129,99   cobre Cortes
--   Corte + Barba ilimitado   R$ 189,99   cobre Cortes e Barba
--   Barba ilimitada           R$ 129,99   cobre Barba
--
-- Poderia ter virado três casos dentro de reservar. Virou tabela porque preço
-- muda, plano some, plano novo aparece, e nada disso deveria pedir deploy.
--
-- Duas coisas passam a valer junto na hora de usar o clube: a categoria do
-- serviço tem que estar no plano, e o dia da semana também. Sexta e sábado o
-- assinante marca normal, só paga o preço cheio.

create table if not exists club_plans (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references barbershops(id) on delete cascade,
  slug text not null,
  nome text not null,
  preco_centavos int not null check (preco_centavos >= 0),
  -- Casa com services.categoria. Vazio seria um plano que não cobre nada.
  cobre_categorias text[] not null check (cardinality(cobre_categorias) > 0),
  -- 0 = domingo, 1 = segunda ... 6 = sábado, igual ao extract(dow).
  dias_semana int[] not null check (cardinality(dias_semana) > 0),
  duracao_dias int not null default 30 check (duracao_dias > 0),
  ativo boolean not null default true,
  ordem int not null default 0,
  unique (barbershop_id, slug)
);

alter table club_plans enable row level security;

alter table subscriptions
  add column if not exists plan_id uuid references club_plans(id);

insert into club_plans (
  barbershop_id, slug, nome, preco_centavos,
  cobre_categorias, dias_semana, ordem
)
select b.id, d.slug, d.nome, d.preco, d.cobre, '{1,2,3,4}'::int[], d.ordem
  from barbershops b
  cross join (values
    ('corte',       'Corte ilimitado',         12999, array['Cortes'],          0),
    ('corte_barba', 'Corte + Barba ilimitado', 18999, array['Cortes','Barba'],  1),
    ('barba',       'Barba ilimitada',         12999, array['Barba'],           2)
  ) as d(slug, nome, preco, cobre, ordem)
 where b.slug = 'johny-barbearia'
on conflict (barbershop_id, slug) do update
   set nome = excluded.nome,
       preco_centavos = excluded.preco_centavos,
       cobre_categorias = excluded.cobre_categorias,
       dias_semana = excluded.dias_semana;

-- Quem já era do clube vira "Corte ilimitado", que é o que ele tinha. O preço
-- combinado com cada um fica onde está: reajustar assinatura viva é decisão do
-- Johny, não efeito colateral de migration.
update subscriptions s
   set plan_id = p.id
  from club_plans p
 where p.barbershop_id = s.barbershop_id
   and p.slug = 'corte'
   and s.plan_id is null;

-- A barba entra no clube porque agora existe plano que a cobre. Quem decide se
-- um serviço específico entra continua sendo esta coluna, editável no painel:
-- o plano diz a categoria, o serviço tem a última palavra.
update services
   set coberto_pelo_clube = true,
       abate_centavos = preco_centavos
 where categoria in ('Cortes', 'Barba');

-- Vitrine: o "a partir de" da landing é o plano mais barato.
update barbershops
   set clube_preco_centavos = 12999
 where slug = 'johny-barbearia';
