-- A aba Agenda numa consulta só.
--
-- Ela precisava de cinco leituras: os agendamentos, a lista de barbeiros para
-- traduzir id em apelido, os bloqueios do dia, o expediente e de novo os
-- barbeiros. Duas delas ainda vinham em fila, porque dependiam da lista de ids.
--
-- Cada leitura dessas é uma viagem de rede inteira até o Supabase. Somadas,
-- eram uns 450ms só para desenhar a aba que o Johny mais abre. Aqui vira uma.
--
-- O recorte por papel é o mesmo de agenda_do_dia, e pelo mesmo motivo: o
-- barbeiro recebe só a própria coluna, dê o que der no que ele mandar.

create or replace function public.painel_agenda(p_chave uuid, p_data date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  s app.sessao;
  v_escopo uuid;
  v_dow int;
begin
  s := app.resolver(p_chave);
  v_escopo := case when s.papel = 'barber' then s.barbeiro_id else null end;
  v_dow := extract(dow from p_data);

  return jsonb_build_object(
    'marcados', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', a.id,
                 'barber_id', a.barber_id,
                 'barbeiro', b.apelido,
                 'inicio', a.inicio,
                 'fim', a.fim,
                 'status', a.status,
                 'valor_centavos', a.valor_centavos,
                 'usou_credito_clube', a.usou_credito_clube,
                 'cliente', c.nome,
                 'telefone', c.telefone,
                 'assinante', exists (
                   select 1 from subscriptions sub
                    where sub.client_id = c.id and sub.status = 'ativa'
                 ),
                 'servico', sv.nome,
                 'duracao_min', sv.duracao_min
               ) order by a.inicio
             )
        from appointments a
        join barbers  b  on b.id  = a.barber_id
        join clients  c  on c.id  = a.client_id
        join services sv on sv.id = a.service_id
       where a.barbershop_id = s.barbearia_id
         and (v_escopo is null or a.barber_id = v_escopo)
         and a.inicio >= (p_data::text || ' 00:00')::timestamp
                         at time zone 'America/Fortaleza'
         and a.inicio <  ((p_data + 1)::text || ' 00:00')::timestamp
                         at time zone 'America/Fortaleza'
         and a.status <> 'expirado'
    ), '[]'::jsonb),

    -- Só os pontuais: o almoço fixo mora em dia_semana e não se solta daqui.
    'bloqueios', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', k.id,
                 'barber_id', k.barber_id,
                 'inicio', k.inicio,
                 'fim', k.fim,
                 'motivo', k.motivo
               ) order by k.inicio
             )
        from breaks k
        join barbers b on b.id = k.barber_id
       where b.barbershop_id = s.barbearia_id
         and (v_escopo is null or k.barber_id = v_escopo)
         and k.data = p_data
    ), '[]'::jsonb),

    'barbeiros', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', b.id, 'apelido', b.apelido)
               order by b.ordem
             )
        from barbers b
       where b.barbershop_id = s.barbearia_id
         and b.ativo
         and (v_escopo is null or b.id = v_escopo)
    ), '[]'::jsonb),

    -- O mais cedo que alguém abre e o mais tarde que alguém fecha nesse dia.
    -- null quando ninguém trabalha, e aí não há o que fechar.
    -- left(...::text, 5) e não to_char: não existe to_char para o tipo time,
    -- e o cast implícito para interval é justamente o tipo de detalhe que só
    -- aparece em produção.
    'janela', (
      select case
               when count(*) = 0 then null::jsonb
               else jsonb_build_object(
                      'abre', left(min(w.abre)::text, 5),
                      'fecha', left(max(w.fecha)::text, 5)
                    )
             end
        from working_hours w
        join barbers b on b.id = w.barber_id
       where b.barbershop_id = s.barbearia_id
         and b.ativo
         and (v_escopo is null or b.id = v_escopo)
         and w.dia_semana = v_dow
         and w.ativo
    )
  );
end $$;

revoke all on function public.painel_agenda from public, anon, authenticated;
