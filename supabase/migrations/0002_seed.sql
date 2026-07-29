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
  'opcional',
  15,
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
    (casa, 'Johny',            'Johny', 'navalha e barba',          0),
    (casa, 'Diego Nascimento', 'Diego', 'degradê',                  1),
    (casa, 'Kaio Ferreira',    'Kaio',  'platinado e sobrancelha',  2);

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

  insert into services (
    barbershop_id, nome, categoria, duracao_min, preco_centavos,
    coberto_pelo_clube, abate_centavos, tag, ordem
  ) values
    (casa, 'Corte social',     'Cortes',     30,  3500, true,  3500, null,                    0),
    (casa, 'Corte degradê',    'Cortes',     40,  4000, true,  4000, 'mais pedido',           1),
    (casa, 'Corte + barba',    'Cortes',     60,  6000, true,  4000, 'clube cobre o corte',   2),
    (casa, 'Barba na navalha', 'Barba',      30,  3000, false,    0, null,                    3),
    (casa, 'Pezinho',          'Acabamento', 15,  1500, false,    0, null,                    4),
    (casa, 'Sobrancelha',      'Acabamento', 10,  1200, false,    0, null,                    5),
    (casa, 'Platinado',        'Química',   120, 15000, false,    0, null,                    6);
end $$;
