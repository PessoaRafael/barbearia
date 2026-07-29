-- Faltou isto: os enums e o tipo app.sessao moram no schema `app`, e a API
-- precisa de USAGE nele só para resolver o tipo das colunas e dos retornos.
--
-- Dar USAGE no schema não dá acesso a nada dentro dele: as tabelas continuam
-- todas em `public` com RLS negando por padrão, e as funções seguem revogadas
-- de anon e authenticated. Sem isto, qualquer insert em access_keys ou
-- appointments morre com "permission denied for schema app".

grant usage on schema app to anon, authenticated, service_role;
