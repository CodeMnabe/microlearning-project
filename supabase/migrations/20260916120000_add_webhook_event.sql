-- Guarda e deduplica os eventos do Bird antes de responder ao webhook.
-- O reviewer deve correr este SQL no merge, antes do deploy.

create table if not exists public.webhook_event (
  id bigserial primary key,
  provider text not null default 'bird',
  event_key text not null,
  event_type text,
  payload jsonb not null,
  status text not null default 'received'
    check (status in ('received', 'processing', 'done', 'failed')),
  attempts integer not null default 0,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_key)
);

create index if not exists webhook_event_status_received_at_idx
  on public.webhook_event (status, received_at);

-- Os payloads são acessíveis apenas pelo servidor com service role.
alter table public.webhook_event enable row level security;
