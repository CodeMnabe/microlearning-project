-- Executar manualmente no SQL Editor do Supabase antes do deploy da #109.
alter table public.organization
  add column if not exists favicon_url text;
