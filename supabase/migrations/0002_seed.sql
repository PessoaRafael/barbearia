-- Dados reais da Johny Barbearia.
-- O token do super user NÃO nasce aqui: ele é gerado por `npm run token:owner`,
-- que imprime o código uma única vez e guarda só o hash. Ver README.

insert into barbershops (
  nome, slug, cidade, endereco, telefone,
  pix_key, pix_titular, pagamento_modalidade, reserva_minutos,
  lembrete_horas, clube_ativo, clube_preco_centavos, clube_cortes_mes
) values (
  'Johny Barbearia',
  'johny-barbearia',
  'Natal, RN',
  'R. Djalma Maranhão, 463-2, Nova Descoberta, Natal/RN, 59075-290',
  '84999835180',
  '84999835180',
  'Johny Rodrigues Gomes',
  -- A casa não atende sem pagamento antecipado: o horário só fica de pé
  -- depois que o pix cai.
  'obrigatorio',
  -- Uma hora, não quinze minutos: quem confirma o pix é o Johny, na mão, e
  -- ele está com a máquina ligada. Prazo curto expira reserva de gente que
  -- pagou de verdade.
  60,
  3,
  true,
  9900,
  4
) on conflict (slug) do nothing;

do $$
declare
  casa uuid;
  barbeiro record;
  dia int;
begin
  select id into casa from barbershops where slug = 'johny-barbearia';

  insert into barbers (barbershop_id, nome, apelido, especialidade, ordem)
  values
    (casa, 'Johny',    'Johny',    'navalha e barba',         0),
    (casa, 'Anderson', 'Anderson', 'degradê',                 1),
    (casa, 'Davi',     'Davi',     'platinado e sobrancelha', 2);

  -- Segunda a sexta 08:30 às 18:30, sábado até 17:30, almoço das 13h às 14h.
  -- Domingo não recebe linha nenhuma, então nunca gera horário.
  for barbeiro in select id from barbers where barbershop_id = casa loop
    for dia in 1..6 loop
      insert into working_hours (barber_id, dia_semana, abre, fecha)
      values (
        barbeiro.id,
        dia,
        '08:30',
        case when dia = 6 then '17:30' else '18:30' end
      );

      insert into breaks (barber_id, dia_semana, inicio, fim, motivo)
      values (barbeiro.id, dia, '13:00', '14:00', 'almoço');
    end loop;
  end loop;

  -- Tabela de preços da casa. O preço é do Johny; a duração e o abate do
  -- clube são estimativa, e as duas mexem no sistema: a duração decide
  -- quantos horários cabem no dia, o abate decide quanto o clube custa.
  -- Ambas são editáveis pela aba Serviços.
  --
  -- O clube é R$ 99 por 4 cortes, ou R$ 24,75 por corte. Cobrir um corte de
  -- R$ 50 inteiro daria prejuízo, então ele abate até R$ 35 e o cliente paga
  -- a diferença nos cortes mais caros.
  insert into services (
    barbershop_id, nome, categoria, duracao_min, preco_centavos,
    coberto_pelo_clube, abate_centavos, ordem
  ) values
    (casa, 'Linha',               'Acabamento',  10, 1500, false,    0,  0),
    (casa, 'Acréscimo navalhado', 'Acabamento',  10, 1500, false,    0,  1),
    (casa, 'Sobrancelhas',        'Acabamento',  15, 2000, false,    0,  2),
    (casa, 'Base do cabelo',      'Acabamento',  15, 2500, false,    0,  3),
    (casa, 'Corte máquina',       'Cortes',      30, 3000, true,  3000,  4),
    (casa, 'Degradê lateral',     'Cortes',      40, 3500, true,  3500,  5),
    (casa, 'Máquina & tesoura',   'Cortes',      45, 4500, true,  3500,  6),
    (casa, 'Corte só na tesoura', 'Cortes',      50, 5000, true,  3500,  7),
    (casa, 'Criança',             'Cortes',      40, 5500, false,    0,  8),
    (casa, 'Barba',               'Barba',       30, 3500, false,    0,  9),
    (casa, 'Barba pigmentada',    'Barba',       40, 4500, false,    0, 10),
    (casa, 'Barbaterapia',        'Barba',       45, 5000, false,    0, 11),
    (casa, 'Hidratação',          'Química',     45, 5000, false,    0, 12),
    (casa, 'Alisante',            'Química',     90, 8000, false,    0, 13),
    (casa, 'Progressiva',         'Química',    120, 9000, false,    0, 14);
end $$;
