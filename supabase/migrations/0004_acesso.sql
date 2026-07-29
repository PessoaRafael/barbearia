-- Controle de acesso.
--
-- O projeto assina JWT com chave assimétrica e a Supabase não entrega a chave
-- privada, então não dá para o servidor forjar um token que o PostgREST leia.
-- Em vez de depender do segredo legado (que está sendo aposentado), a
-- identidade entra como ARGUMENTO: o id da chave de acesso, que vive num
-- cookie httpOnly e nunca passa pelo JavaScript da página.
--
-- A garantia continua sendo do banco, não da tela: estas funções derivam o
-- barbeiro da própria chave e ignoram qualquer barber_id que o chamador mande.
-- Um barbeiro forçando o id de outro na URL não muda nada aqui dentro.

-- ---------------------------------------------------------------------------
-- RLS: negar por padrão
--
-- Nenhuma policy é criada de propósito. Com a publishable key, toda tabela
-- responde vazio, mesmo que a chave vaze. Todo acesso real passa pelo
-- servidor Next, com a secret key, e pelas funções abaixo.
-- ---------------------------------------------------------------------------

alter table barbershops       enable row level security;
alter table barbers           enable row level security;
alter table access_keys       enable row level security;
alter table login_attempts    enable row level security;
alter table working_hours     enable row level security;
alter table breaks            enable row level security;
alter table closures          enable row level security;
alter table services          enable row level security;
alter table clients           enable row level security;
alter table subscriptions     enable row level security;
alter table appointments      enable row level security;
alter table payments          enable row level security;
alter table subscription_uses enable row level security;
alter table cash_entries      enable row level security;
alter table waitlist          enable row level security;
alter table notifications     enable row level security;
alter table audit_log         enable row level security;

-- ---------------------------------------------------------------------------
-- Sessão
-- ---------------------------------------------------------------------------

create type app.sessao as (
  chave_id     uuid,
  papel        app.papel_acesso,
  barbearia_id uuid,
  barbeiro_id  uuid,
  nome         text
);

/**
 * Resolve a chave de acesso. Levanta erro se não existir, tiver sido revogada
 * ou vencido, o chamador nunca recebe uma sessão meia-boca.
 */
create or replace function app.resolver(p_chave uuid)
returns app.sessao
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  v app.sessao;
begin
  select k.id, k.role, k.barbershop_id, k.barber_id,
         coalesce(b.apelido, 'Johny')
    into v
    from access_keys k
    left join barbers b on b.id = k.barber_id
   where k.id = p_chave
     and k.revogada_em is null
     and (k.expira_em is null or k.expira_em > now());

  if v.chave_id is null then
    raise exception 'sessao_invalida' using errcode = '28000';
  end if;

  return v;
end $$;

create or replace function public.sessao_atual(p_chave uuid)
returns app.sessao
language sql
stable
security definer
set search_path = public, app
as $$ select app.resolver(p_chave); $$;

-- ---------------------------------------------------------------------------
-- Agenda com escopo por papel
-- ---------------------------------------------------------------------------

/**
 * Agenda de um dia. O dono vê a casa inteira; o barbeiro vê só a própria
 * coluna. O p_barbeiro só é respeitado para o dono, para o barbeiro ele é
 * ignorado e trocado pelo id da chave dele.
 */
create or replace function public.agenda_do_dia(
  p_chave    uuid,
  p_data     date,
  p_barbeiro uuid default null
)
returns table (
  id              uuid,
  barber_id       uuid,
  barbeiro        text,
  inicio          timestamptz,
  fim             timestamptz,
  status          app.status_agendamento,
  valor_centavos  int,
  usou_credito_clube boolean,
  cliente         text,
  telefone        text,
  assinante       boolean,
  servico         text,
  duracao_min     int
)
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  s app.sessao;
  v_escopo uuid;
begin
  s := app.resolver(p_chave);

  -- Aqui mora a trava: barbeiro só enxerga a si mesmo, dê o que der no p_barbeiro.
  if s.papel = 'barber' then
    v_escopo := s.barbeiro_id;
  else
    v_escopo := p_barbeiro;
  end if;

  return query
    select a.id, a.barber_id, b.apelido, a.inicio, a.fim, a.status,
           a.valor_centavos, a.usou_credito_clube,
           c.nome, c.telefone,
           exists (
             select 1 from subscriptions sub
              where sub.client_id = c.id and sub.status = 'ativa'
           ),
           sv.nome, sv.duracao_min
      from appointments a
      join barbers  b  on b.id  = a.barber_id
      join clients  c  on c.id  = a.client_id
      join services sv on sv.id = a.service_id
     where a.barbershop_id = s.barbearia_id
       and (v_escopo is null or a.barber_id = v_escopo)
       and a.inicio >= (p_data::text || ' 00:00')::timestamp at time zone 'America/Fortaleza'
       and a.inicio <  ((p_data + 1)::text || ' 00:00')::timestamp at time zone 'America/Fortaleza'
       and a.status <> 'expirado'
     order by a.inicio;
end $$;

/** Números do topo, já filtrados pelo papel de quem perguntou. */
create or replace function public.resumo_do_dia(p_chave uuid, p_data date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  s app.sessao;
  v_escopo uuid;
  v_marcados int;
  v_receita int;
  v_pendentes int;
begin
  s := app.resolver(p_chave);
  v_escopo := case when s.papel = 'barber' then s.barbeiro_id else null end;

  select count(*), coalesce(sum(a.valor_centavos), 0)
    into v_marcados, v_receita
    from appointments a
   where a.barbershop_id = s.barbearia_id
     and (v_escopo is null or a.barber_id = v_escopo)
     and a.status in ('confirmado', 'concluido')
     and a.inicio >= (p_data::text || ' 00:00')::timestamp at time zone 'America/Fortaleza'
     and a.inicio <  ((p_data + 1)::text || ' 00:00')::timestamp at time zone 'America/Fortaleza';

  select count(*) into v_pendentes
    from payments p
    join appointments a on a.id = p.appointment_id
   where p.barbershop_id = s.barbearia_id
     and p.status = 'aguardando'
     and (v_escopo is null or a.barber_id = v_escopo);

  return jsonb_build_object(
    'papel', s.papel,
    'marcados', v_marcados,
    'receita_centavos', v_receita,
    'pix_pendentes', v_pendentes
  );
end $$;

-- ---------------------------------------------------------------------------
-- Ações do barbeiro na própria agenda
-- ---------------------------------------------------------------------------

/** Concluir ou marcar falta. Barbeiro só mexe no que é dele. */
create or replace function public.encerrar_atendimento(
  p_chave       uuid,
  p_agendamento uuid,
  p_status      text
)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
declare
  s app.sessao;
  v_ag appointments%rowtype;
begin
  s := app.resolver(p_chave);

  if p_status not in ('concluido', 'faltou') then
    raise exception 'status_invalido' using errcode = 'P0001';
  end if;

  select * into v_ag from appointments where id = p_agendamento for update;
  if not found or v_ag.barbershop_id <> s.barbearia_id then
    raise exception 'agendamento_inexistente' using errcode = 'P0002';
  end if;

  if s.papel = 'barber' and v_ag.barber_id <> s.barbeiro_id then
    raise exception 'nao_e_sua_agenda' using errcode = '42501';
  end if;

  update appointments
     set status = p_status::app.status_agendamento
   where id = p_agendamento;

  if p_status = 'concluido' then
    update clients
       set total_cortes = total_cortes + 1,
           total_gasto_centavos = total_gasto_centavos + v_ag.valor_centavos,
           ultimo_corte_em = now(),
           primeiro_corte_em = coalesce(primeiro_corte_em, now())
     where id = v_ag.client_id;

    if v_ag.valor_centavos > 0 then
      insert into cash_entries (
        barbershop_id, barber_id, tipo, categoria, descricao,
        valor_centavos, appointment_id
      ) values (
        v_ag.barbershop_id, v_ag.barber_id, 'entrada', 'atendimento',
        'corte concluído', v_ag.valor_centavos, v_ag.id
      );
    end if;
  else
    update clients set faltas = faltas + 1 where id = v_ag.client_id;
  end if;

  insert into audit_log (
    barbershop_id, actor_id, actor_role, acao, entidade, entidade_id, antes, depois
  ) values (
    s.barbearia_id, s.barbeiro_id, s.papel::text, 'encerrar', 'appointments',
    p_agendamento,
    jsonb_build_object('status', v_ag.status),
    jsonb_build_object('status', p_status)
  );
end $$;

/** Bloqueio pontual: o barbeiro fecha um pedaço do próprio dia. */
create or replace function public.bloquear_horario(
  p_chave    uuid,
  p_data     date,
  p_inicio   time,
  p_fim      time,
  p_motivo   text default null,
  p_barbeiro uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  s app.sessao;
  v_alvo uuid;
  v_id uuid;
begin
  s := app.resolver(p_chave);
  v_alvo := case when s.papel = 'barber' then s.barbeiro_id else p_barbeiro end;

  if v_alvo is null then
    raise exception 'barbeiro_obrigatorio' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from barbers where id = v_alvo and barbershop_id = s.barbearia_id
  ) then
    raise exception 'barbeiro_de_outra_casa' using errcode = '42501';
  end if;

  insert into breaks (barber_id, data, inicio, fim, motivo)
       values (v_alvo, p_data, p_inicio, p_fim, coalesce(p_motivo, 'bloqueio'))
    returning id into v_id;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Só o dono
-- ---------------------------------------------------------------------------

create or replace function app.exigir_dono(p_chave uuid)
returns app.sessao
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare s app.sessao;
begin
  s := app.resolver(p_chave);
  if s.papel <> 'owner' then
    raise exception 'so_o_dono' using errcode = '42501';
  end if;
  return s;
end $$;

/** Confirmar ou negar pix. Nunca a palavra do cliente: sempre a do Johny. */
create or replace function public.decidir_pix(
  p_chave     uuid,
  p_pagamento uuid,
  p_recebido  boolean
)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
declare
  s app.sessao;
  v_pg payments%rowtype;
  v_ag appointments%rowtype;
  v_cliente clients%rowtype;
begin
  s := app.exigir_dono(p_chave);

  select * into v_pg from payments where id = p_pagamento for update;
  if not found or v_pg.barbershop_id <> s.barbearia_id then
    raise exception 'pagamento_inexistente' using errcode = 'P0002';
  end if;

  select * into v_ag from appointments where id = v_pg.appointment_id for update;
  select * into v_cliente from clients where id = v_ag.client_id;

  if p_recebido then
    update payments
       set status = 'confirmado', confirmado_em = now(), confirmado_por = s.barbeiro_id
     where id = p_pagamento;

    update appointments set status = 'confirmado' where id = v_ag.id;

    insert into cash_entries (
      barbershop_id, barber_id, tipo, categoria, descricao,
      valor_centavos, appointment_id
    ) values (
      s.barbearia_id, v_ag.barber_id, 'entrada', 'pix',
      'pix confirmado', v_pg.valor_centavos, v_ag.id
    );

    insert into notifications (barbershop_id, destino, template, payload, telefone)
    values (
      s.barbearia_id, 'cliente', 'pix_confirmado',
      jsonb_build_object(
        'cliente', split_part(v_cliente.nome, ' ', 1),
        'quando', to_char(v_ag.inicio at time zone 'America/Fortaleza', 'DD/MM HH24:MI')
      ),
      v_cliente.telefone
    );
  else
    update payments set status = 'negado' where id = p_pagamento;
    perform public.cancelar(v_ag.id, 'owner');
  end if;

  insert into audit_log (
    barbershop_id, actor_id, actor_role, acao, entidade, entidade_id, depois
  ) values (
    s.barbearia_id, s.barbeiro_id, 'owner', 'decidir_pix', 'payments',
    p_pagamento, jsonb_build_object('recebido', p_recebido)
  );
end $$;

/** Gera a chave de um barbeiro. O texto puro nunca chega ao banco. */
create or replace function public.criar_chave(
  p_chave    uuid,
  p_barbeiro uuid,
  p_hash     text,
  p_prefixo  text
)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  s app.sessao;
  v_id uuid;
begin
  s := app.exigir_dono(p_chave);

  if not exists (
    select 1 from barbers where id = p_barbeiro and barbershop_id = s.barbearia_id
  ) then
    raise exception 'barbeiro_de_outra_casa' using errcode = '42501';
  end if;

  -- Uma chave viva por barbeiro: gerar de novo derruba a anterior.
  update access_keys
     set revogada_em = now()
   where barber_id = p_barbeiro and revogada_em is null;

  insert into access_keys (
    barbershop_id, barber_id, role, key_hash, key_prefix, criada_por
  ) values (
    s.barbearia_id, p_barbeiro, 'barber', p_hash, p_prefixo, s.barbeiro_id
  ) returning id into v_id;

  insert into audit_log (
    barbershop_id, actor_role, acao, entidade, entidade_id
  ) values (s.barbearia_id, 'owner', 'criar_chave', 'access_keys', v_id);

  return v_id;
end $$;

create or replace function public.revogar_chave(p_chave uuid, p_alvo uuid)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
declare s app.sessao;
begin
  s := app.exigir_dono(p_chave);

  update access_keys
     set revogada_em = now()
   where id = p_alvo and barbershop_id = s.barbearia_id and revogada_em is null;

  insert into audit_log (
    barbershop_id, actor_role, acao, entidade, entidade_id
  ) values (s.barbearia_id, 'owner', 'revogar_chave', 'access_keys', p_alvo);
end $$;

-- Nada disso é chamável pela publishable key: só o servidor, com a secret.
revoke all on function public.sessao_atual        from public, anon, authenticated;
revoke all on function public.agenda_do_dia       from public, anon, authenticated;
revoke all on function public.resumo_do_dia       from public, anon, authenticated;
revoke all on function public.encerrar_atendimento from public, anon, authenticated;
revoke all on function public.bloquear_horario    from public, anon, authenticated;
revoke all on function public.decidir_pix         from public, anon, authenticated;
revoke all on function public.criar_chave         from public, anon, authenticated;
revoke all on function public.revogar_chave       from public, anon, authenticated;
