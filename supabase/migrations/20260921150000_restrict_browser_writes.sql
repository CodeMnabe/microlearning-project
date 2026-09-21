-- Restringe o que o browser pode escrever pela Data API em organization e user.
-- A policy de UPDATE em organization só exige ser o owner, sem limitar colunas: um
-- cliente conseguia mudar o próprio channel_id, teams_tenant_id ou plan_id. Em user,
-- o owner conseguia inserir, alterar e apagar sem passar pelas validações do servidor.
-- A aplicação só precisa de atualizar organization.theme pelo browser; tudo o resto
-- passa pelas rotas do servidor, que usam service role e não são afetadas.
-- O João deve correr este SQL no SQL Editor do Supabase. É compatível com o código
-- em produção e pode ser corrido mais de uma vez.

revoke insert, update, delete on table public.organization from anon, authenticated;
grant update (theme) on table public.organization to authenticated;

revoke insert, update, delete on table public."user" from anon, authenticated;
