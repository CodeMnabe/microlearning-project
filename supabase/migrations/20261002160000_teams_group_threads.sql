-- Conversas de grupo do Teams (#164). A conversa de um grupo não tem utilizador,
-- mas thread.user_id era obrigatório, por isso a primeira mensagem num grupo
-- falhava. Os grupos passam também a guardar o nome.
-- Correr no SQL Editor do Supabase ANTES do deploy: o código novo já grava o
-- nome do grupo. Pode ser corrido mais de uma vez.

alter table public.thread alter column user_id drop not null;

-- As conversas individuais continuam a precisar de utilizador.
alter table public.thread drop constraint if exists thread_user_scope_has_user;
alter table public.thread add constraint thread_user_scope_has_user
  check (scope <> 'user' or user_id is not null);

alter table public.teams_installation add column if not exists name text;
