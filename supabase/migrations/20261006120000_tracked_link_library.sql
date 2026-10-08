-- Links rastreados já usados, um por nome e destino, para o composer os poder
-- reutilizar sem os escrever outra vez.
-- O tracked_link tem uma linha por destinatário e por envio; esta vista junta-as
-- e fica com a chave do envio mais recente.
-- Só o servidor a lê, com service role: o browser não tem acesso, porque a vista
-- mostra links de todas as organizações.
-- Deve ser corrido no SQL Editor do Supabase antes do deploy. Pode ser corrido
-- mais de uma vez. `security_invoker` exige Postgres 15 ou mais recente.

create or replace view public.tracked_link_library
with (security_invoker = true) as
select
  org_id,
  link_label,
  destination_url,
  (array_agg(link_key order by created_at desc))[1] as link_key,
  max(created_at) as last_used_at
from public.tracked_link
where link_label is not null
  and destination_url is not null
group by org_id, link_label, destination_url;

revoke all on table public.tracked_link_library from anon, authenticated;
