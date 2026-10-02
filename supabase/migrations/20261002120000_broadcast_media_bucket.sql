-- Bucket próprio para a multimédia das mensagens (imagens, PDF e MP4).
-- O bucket images ficou limitado a imagens até 5 MB na #117, por isso os PDF
-- e MP4 do composer deixaram de subir. Os ficheiros antigos e os favicons
-- continuam no images.
-- Correr no SQL Editor do Supabase ANTES do deploy: o código novo já envia
-- para este bucket. Pode ser corrido mais de uma vez.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'broadcast-media',
  'broadcast-media',
  true,
  20971520,
  '{image/png,image/jpeg,image/webp,image/gif,application/pdf,video/mp4}'
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Sem policy de leitura: o bucket é público, os URLs abrem sem ela, e assim
-- ninguém consegue listar os ficheiros de outras organizações pela API.
-- Listar e apagar faz-se no servidor, com a service role.

drop policy if exists broadcast_media_owner_insert on storage.objects;
create policy broadcast_media_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'broadcast-media'
  and (storage.foldername(name))[1] = 'broadcasts'
  and public.storage_org_owned_by_user((storage.foldername(name))[2])
);
