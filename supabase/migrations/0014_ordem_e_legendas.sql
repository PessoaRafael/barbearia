-- Ordem da vitrine e legenda da equipe.
--
-- Já aplicado no banco do Johny pela API de dados; fica aqui para um banco
-- novo nascer igual.
--
-- Corte primeiro: quem abre o agendamento vem atrás de corte, e a lista
-- começava por Linha e Acréscimo navalhado, que são acabamento. A ordem manda
-- na vitrine, no agendamento e nos atalhos do chat.
--
-- E ninguém é especialista em uma coisa só: os três fazem tudo, então a
-- legenda deixou de vender especialidade que não existe.

update services set ordem = dados.pos
  from (values
    ('Corte máquina',        0),
    ('Degradê lateral',      1),
    ('Máquina & tesoura',    2),
    ('Corte só na tesoura',  3),
    ('Criança',              4),
    ('Barba',                5),
    ('Barba pigmentada',     6),
    ('Barbaterapia',         7),
    ('Linha',                8),
    ('Acréscimo navalhado',  9),
    ('Sobrancelhas',        10),
    ('Base do cabelo',      11),
    ('Hidratação',          12),
    ('Alisante',            13),
    ('Progressiva',         14)
  ) as dados(nome, pos)
 where services.nome = dados.nome;

update barbers
   set especialidade = 'corte, barba e química'
 where apelido in ('Johny', 'Anderson', 'Davi');
