-- Limita tamanhos e tipos nos buckets e restringe o acesso aos ficheiros dos assistentes
-- ao owner da organização. Mantém imagens públicas e uploads em broadcasts/.
-- O João deve correr este SQL no SQL Editor do Supabase antes do deploy.

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = '{image/png,image/jpeg,image/webp,image/gif}',
    public = true
where id = 'images';

update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = '{application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown,text/csv,application/json,text/html}',
    public = false
where id = 'assistant-uploads';

create or replace function public.storage_path_owned_by_user(object_name text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization
    where id::text = (storage.foldername(object_name))[1]
      and owner_user_id = auth.uid()
  );
$$;

revoke all on function public.storage_path_owned_by_user(text) from public;
grant execute on function public.storage_path_owned_by_user(text) to authenticated;

drop policy if exists "Authenticated delete images" on storage.objects;
drop policy if exists "Authenticated upload images" on storage.objects;
drop policy if exists "Public read images" on storage.objects;
drop policy if exists "objects: delete from assistant-uploads" on storage.objects;
drop policy if exists "objects: insert into assistant-uploads" on storage.objects;
drop policy if exists "objects: select from assistant-uploads" on storage.objects;

drop policy if exists images_public_read on storage.objects;
create policy images_public_read on storage.objects
for select to public
using (bucket_id = 'images');

drop policy if exists images_owner_insert on storage.objects;
create policy images_owner_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'images' and (storage.foldername(name))[1] = 'broadcasts');

drop policy if exists assistant_uploads_owner_select on storage.objects;
create policy assistant_uploads_owner_select on storage.objects
for select to authenticated
using (bucket_id = 'assistant-uploads' and public.storage_path_owned_by_user(name));

drop policy if exists assistant_uploads_owner_insert on storage.objects;
create policy assistant_uploads_owner_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'assistant-uploads' and public.storage_path_owned_by_user(name));
