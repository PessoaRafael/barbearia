-- Fecha uma porta que o papel 'client' abriu.
--
-- app.resolver é a porta de entrada de tudo que é da equipe: agenda_do_dia,
-- resumo_do_dia, encerrar_atendimento, bloquear_horario e exigir_dono. Todas
-- decidem "é barbeiro? então só a coluna dele; senão, a casa inteira".
--
-- Enquanto só existiam dono e barbeiro isso bastava. Com a chave do assinante,
-- "senão" passou a incluir o cliente, que cairia no ramo do dono. Um assinante
-- do clube conseguiria fechar a agenda da casa dele.
--
-- A área do clube não passa por aqui: area_do_cliente lê access_keys direto.

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
     and (k.expira_em is null or k.expira_em > now())
     and k.role in ('owner', 'barber');

  if v.chave_id is null then
    raise exception 'sessao_invalida' using errcode = '28000';
  end if;

  return v;
end $$;
