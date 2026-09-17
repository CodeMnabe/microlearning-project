-- Corpo da mensagem de abertura WhatsApp (issue #95)
--
-- O template de abertura é único e igual para todas as organizações.
-- Só o corpo (variável "mensagem") é personalizável por organização.
-- Quando a coluna está vazia, a aplicação usa o texto por omissão.
--
-- Executar no SQL Editor do Supabase.

alter table public.organization
  add column if not exists whatsapp_opening_body text;

comment on column public.organization.whatsapp_opening_body is
  'Texto do corpo do template de abertura WhatsApp. NULL usa o texto por omissão da aplicação.';
