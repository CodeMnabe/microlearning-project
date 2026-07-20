-- Durable inbox, effect outbox, claims, and leases for authenticated webhooks.
-- This migration intentionally does not copy historical webhook payloads.

begin;

create table public.webhook_event (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  organization_id integer not null,
  event_type text not null,
  scope_id text not null,
  external_event_id text not null,
  payload_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'received',
  attempt_count integer not null default 0,
  worker_id text null,
  claim_token uuid null,
  claimed_at timestamp with time zone null,
  claim_expires_at timestamp with time zone null,
  next_attempt_at timestamp with time zone not null default now(),
  processed_at timestamp with time zone null,
  last_error text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint webhook_event_organization_id_fkey
    foreign key (organization_id)
    references public.organization (id)
    on delete cascade,
  constraint webhook_event_provider_check
    check (provider in ('messagebird', 'teams')),
  constraint webhook_event_status_check
    check (
      status in (
        'received',
        'processing',
        'succeeded',
        'retryable_failed',
        'unknown_outcome',
        'failed',
        'conflict'
      )
    ),
  constraint webhook_event_payload_hash_check
    check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint webhook_event_metadata_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint webhook_event_identity_key
    unique (
      provider,
      organization_id,
      event_type,
      scope_id,
      external_event_id
    )
);

create index webhook_event_claim_due_idx
  on public.webhook_event (status, next_attempt_at, created_at, id);

create index webhook_event_lease_idx
  on public.webhook_event (claim_expires_at)
  where status = 'processing';

create table public.webhook_effect (
  id uuid primary key default gen_random_uuid(),
  webhook_event_id uuid not null,
  effect_type text not null,
  effect_key text not null,
  is_external boolean not null default false,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  worker_id text null,
  claim_token uuid null,
  claimed_at timestamp with time zone null,
  claim_expires_at timestamp with time zone null,
  next_attempt_at timestamp with time zone not null default now(),
  provider_reference text null,
  request_hash text null,
  result jsonb null,
  last_error text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint webhook_effect_event_id_fkey
    foreign key (webhook_event_id)
    references public.webhook_event (id)
    on delete cascade,
  constraint webhook_effect_status_check
    check (
      status in (
        'pending',
        'processing',
        'succeeded',
        'retryable_failed',
        'unknown_outcome',
        'failed',
        'conflict'
      )
    ),
  constraint webhook_effect_request_hash_check
    check (request_hash is null or request_hash ~ '^[0-9a-f]{64}$'),
  constraint webhook_effect_result_check
    check (result is null or jsonb_typeof(result) in ('object', 'array')),
  constraint webhook_effect_identity_key
    unique (webhook_event_id, effect_type, effect_key)
);

create index webhook_effect_claim_due_idx
  on public.webhook_effect (status, next_attempt_at, created_at, id);

create index webhook_effect_lease_idx
  on public.webhook_effect (claim_expires_at)
  where status = 'processing';

create table public.conversation_reservation (
  id uuid primary key default gen_random_uuid(),
  organization_id integer not null,
  provider text not null,
  scope_id text not null,
  user_id integer null,
  actor_key text not null,
  assistant_id integer not null,
  channel text not null,
  status text not null default 'ready',
  current_thread_id integer null,
  claim_token uuid null,
  claimed_at timestamp with time zone null,
  claim_expires_at timestamp with time zone null,
  attempt_count integer not null default 0,
  remote_started_at timestamp with time zone null,
  last_error text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint conversation_reservation_organization_id_fkey
    foreign key (organization_id) references public.organization (id) on delete cascade,
  constraint conversation_reservation_user_id_fkey
    foreign key (user_id) references public."user" (id) on delete cascade,
  constraint conversation_reservation_assistant_id_fkey
    foreign key (assistant_id) references public.assistant (id) on delete cascade,
  constraint conversation_reservation_current_thread_id_fkey
    foreign key (current_thread_id) references public.thread (id) on delete set null,
  constraint conversation_reservation_provider_check
    check (provider in ('messagebird', 'teams')),
  constraint conversation_reservation_channel_check
    check (channel in ('whatsapp', 'teams')),
  constraint conversation_reservation_actor_key_check
    check (
      actor_key = case
        when user_id is null then 'group'
        else 'user:' || user_id::text
      end
    ),
  constraint conversation_reservation_status_check
    check (status in ('ready', 'processing', 'retryable_failed', 'unknown_outcome', 'failed')),
  constraint conversation_reservation_identity_key
    unique (organization_id, provider, scope_id, actor_key, assistant_id, channel)
);

create index conversation_reservation_lease_idx
  on public.conversation_reservation (claim_expires_at)
  where status = 'processing';

alter table public.message
  add column webhook_event_id uuid null,
  add column webhook_effect_key text null,
  add constraint message_webhook_event_id_fkey
    foreign key (webhook_event_id)
    references public.webhook_event (id)
    on delete set null;

create unique index message_webhook_effect_key_idx
  on public.message (webhook_event_id, webhook_effect_key)
  where webhook_event_id is not null
    and webhook_effect_key is not null;

alter table public.pending_outreach
  drop constraint if exists pending_outreach_status_check,
  add column attempt_count integer not null default 0,
  add column claimed_at timestamp with time zone null,
  add column claim_expires_at timestamp with time zone null,
  add column next_attempt_at timestamp with time zone not null default now(),
  add column claim_token uuid null,
  add column webhook_event_id uuid null,
  add column send_started_at timestamp with time zone null,
  add column last_error text null,
  add constraint pending_outreach_webhook_event_id_fkey
    foreign key (webhook_event_id)
    references public.webhook_event (id)
    on delete set null,
  add constraint pending_outreach_status_check
    check (
      status in (
        'pending',
        'processing',
        'replied',
        'retryable_failed',
        'unknown_outcome',
        'failed',
        'expired'
      )
    );

create index pending_outreach_claim_due_idx
  on public.pending_outreach (status, next_attempt_at, expires_at, id);

create or replace function public.register_webhook_event(
  p_provider text,
  p_organization_id integer,
  p_event_type text,
  p_scope_id text,
  p_external_event_id text,
  p_payload_hash text,
  p_metadata jsonb
)
returns table (
  outcome text,
  event_id uuid,
  event_status text,
  attempt_count integer,
  claim_expires_at timestamp with time zone
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.webhook_event%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'register_webhook_event is restricted to service_role';
  end if;

  if nullif(pg_catalog.btrim(p_provider), '') is null
     or p_organization_id is null
     or nullif(pg_catalog.btrim(p_event_type), '') is null
     or nullif(pg_catalog.btrim(p_scope_id), '') is null
     or nullif(pg_catalog.btrim(p_external_event_id), '') is null
     or p_payload_hash is null
     or p_metadata is null then
    raise exception using
      errcode = '22004',
      message = 'register_webhook_event requires non-NULL normalized arguments';
  end if;

  if p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'register_webhook_event payload hash is invalid';
  end if;

  if pg_catalog.jsonb_typeof(p_metadata) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'register_webhook_event metadata must be an object';
  end if;

  insert into public.webhook_event (
    provider,
    organization_id,
    event_type,
    scope_id,
    external_event_id,
    payload_hash,
    metadata
  )
  values (
    pg_catalog.lower(pg_catalog.btrim(p_provider)),
    p_organization_id,
    pg_catalog.btrim(p_event_type),
    pg_catalog.btrim(p_scope_id),
    pg_catalog.btrim(p_external_event_id),
    p_payload_hash,
    p_metadata
  )
  on conflict (
    provider,
    organization_id,
    event_type,
    scope_id,
    external_event_id
  ) do nothing
  returning * into v_event;

  if found then
    return query
    select 'accepted'::text, v_event.id, v_event.status,
      v_event.attempt_count, v_event.claim_expires_at;
    return;
  end if;

  select event_row.*
  into v_event
  from public.webhook_event as event_row
  where event_row.provider = pg_catalog.lower(pg_catalog.btrim(p_provider))
    and event_row.organization_id = p_organization_id
    and event_row.event_type = pg_catalog.btrim(p_event_type)
    and event_row.scope_id = pg_catalog.btrim(p_scope_id)
    and event_row.external_event_id = pg_catalog.btrim(p_external_event_id)
  for update of event_row;

  if v_event.payload_hash <> p_payload_hash then
    return query
    select 'payload_conflict'::text, v_event.id, v_event.status,
      v_event.attempt_count, v_event.claim_expires_at;
    return;
  end if;

  return query
  select
    case
      when v_event.status = 'succeeded' then 'duplicate_succeeded'
      when v_event.status = 'retryable_failed'
        and v_event.next_attempt_at <= pg_catalog.now() then 'retryable'
      when v_event.status = 'received' then 'accepted'
      else 'duplicate_processing'
    end::text,
    v_event.id,
    v_event.status,
    v_event.attempt_count,
    v_event.claim_expires_at;
end;
$$;

create or replace function public.claim_webhook_events(
  p_worker_id text,
  p_limit integer default 25,
  p_lease_seconds integer default 120
)
returns setof public.webhook_event
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'claim_webhook_events is restricted to service_role';
  end if;

  if nullif(pg_catalog.btrim(p_worker_id), '') is null
     or p_limit < 1 or p_limit > 100
     or p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception using
      errcode = '22023',
      message = 'claim_webhook_events arguments are invalid';
  end if;

  return query
  with candidates as (
    select event_row.id
    from public.webhook_event as event_row
    where (
      event_row.status = 'received'
      or (
        event_row.status = 'retryable_failed'
        and event_row.next_attempt_at <= pg_catalog.now()
      )
      or (
        event_row.status = 'processing'
        and event_row.claim_expires_at < pg_catalog.now()
      )
    )
    order by event_row.created_at, event_row.id
    for update of event_row skip locked
    limit p_limit
  )
  update public.webhook_event as event_row
  set
    status = 'processing',
    attempt_count = event_row.attempt_count + 1,
    worker_id = pg_catalog.btrim(p_worker_id),
    claim_token = gen_random_uuid(),
    claimed_at = pg_catalog.now(),
    claim_expires_at = pg_catalog.now()
      + pg_catalog.make_interval(secs => p_lease_seconds),
    last_error = null,
    updated_at = pg_catalog.now()
  from candidates
  where event_row.id = candidates.id
  returning event_row.*;
end;
$$;

create or replace function public.transition_webhook_event(
  p_event_id uuid,
  p_organization_id integer,
  p_claim_token uuid,
  p_status text,
  p_last_error text default null,
  p_next_attempt_at timestamp with time zone default null
)
returns public.webhook_event
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.webhook_event%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'transition_webhook_event is restricted to service_role';
  end if;

  if p_status not in (
    'succeeded', 'retryable_failed', 'unknown_outcome', 'failed'
  ) then
    raise exception using
      errcode = '22023',
      message = 'transition_webhook_event target status is invalid';
  end if;

  update public.webhook_event as event_row
  set
    status = p_status,
    processed_at = case
      when p_status in ('succeeded', 'unknown_outcome', 'failed')
        then pg_catalog.now()
      else event_row.processed_at
    end,
    next_attempt_at = coalesce(p_next_attempt_at, event_row.next_attempt_at),
    last_error = case
      when p_last_error is null then null
      else pg_catalog.left(p_last_error, 1000)
    end,
    worker_id = null,
    claim_token = null,
    claimed_at = null,
    claim_expires_at = null,
    updated_at = pg_catalog.now()
  where event_row.id = p_event_id
    and event_row.organization_id = p_organization_id
    and event_row.status = 'processing'
    and event_row.claim_token = p_claim_token
    and event_row.claim_expires_at >= pg_catalog.now()
  returning * into v_event;

  return v_event;
end;
$$;

create or replace function public.renew_webhook_event_lease(
  p_event_id uuid,
  p_organization_id integer,
  p_claim_token uuid,
  p_lease_seconds integer default 120
)
returns public.webhook_event
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.webhook_event%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'renew_webhook_event_lease is restricted to service_role';
  end if;
  if p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'renew_webhook_event_lease duration is invalid';
  end if;

  update public.webhook_event as event_row
  set claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
      updated_at = pg_catalog.now()
  where event_row.id = p_event_id
    and event_row.organization_id = p_organization_id
    and event_row.status = 'processing'
    and event_row.claim_token = p_claim_token
    and event_row.claim_expires_at >= pg_catalog.now()
  returning * into v_event;
  return v_event;
end;
$$;

create or replace function public.register_webhook_effect(
  p_webhook_event_id uuid,
  p_organization_id integer,
  p_event_claim_token uuid,
  p_effect_type text,
  p_effect_key text,
  p_is_external boolean,
  p_request_hash text default null
)
returns public.webhook_effect
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_effect public.webhook_effect%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'register_webhook_effect is restricted to service_role';
  end if;

  if nullif(pg_catalog.btrim(p_effect_type), '') is null
     or nullif(pg_catalog.btrim(p_effect_key), '') is null
     or (p_request_hash is not null and p_request_hash !~ '^[0-9a-f]{64}$') then
    raise exception using
      errcode = '22023',
      message = 'register_webhook_effect arguments are invalid';
  end if;

  if not exists (
    select 1
    from public.webhook_event as event_row
    where event_row.id = p_webhook_event_id
      and event_row.organization_id = p_organization_id
      and event_row.status = 'processing'
      and event_row.claim_token = p_event_claim_token
      and event_row.claim_expires_at >= pg_catalog.now()
  ) then
    raise exception using
      errcode = '40001',
      message = 'register_webhook_effect event claim is not active';
  end if;

  insert into public.webhook_effect (
    webhook_event_id,
    effect_type,
    effect_key,
    is_external,
    request_hash
  )
  values (
    p_webhook_event_id,
    pg_catalog.btrim(p_effect_type),
    pg_catalog.btrim(p_effect_key),
    p_is_external,
    p_request_hash
  )
  on conflict (webhook_event_id, effect_type, effect_key) do nothing
  returning * into v_effect;

  if found then
    return v_effect;
  end if;

  select effect_row.*
  into v_effect
  from public.webhook_effect as effect_row
  where effect_row.webhook_event_id = p_webhook_event_id
    and effect_row.effect_type = pg_catalog.btrim(p_effect_type)
    and effect_row.effect_key = pg_catalog.btrim(p_effect_key)
  for update of effect_row;

  if v_effect.request_hash is distinct from p_request_hash then
    -- Report the conflict to the caller without changing the canonical effect.
    -- Assignments below affect only the local row variable.
    v_effect.status := 'conflict';
    v_effect.last_error := 'Request hash differs for the same effect identity';
  end if;

  return v_effect;
end;
$$;

create or replace function public.claim_webhook_effect(
  p_effect_id uuid,
  p_webhook_event_id uuid,
  p_organization_id integer,
  p_event_claim_token uuid,
  p_worker_id text,
  p_lease_seconds integer default 120
)
returns table (
  outcome text,
  effect_id uuid,
  effect_status text,
  effect_claim_token uuid,
  result jsonb,
  provider_reference text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_effect public.webhook_effect%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'claim_webhook_effect is restricted to service_role';
  end if;

  if nullif(pg_catalog.btrim(p_worker_id), '') is null
     or p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception using
      errcode = '22023',
      message = 'claim_webhook_effect arguments are invalid';
  end if;

  if not exists (
    select 1
    from public.webhook_event as event_row
    where event_row.id = p_webhook_event_id
      and event_row.organization_id = p_organization_id
      and event_row.status = 'processing'
      and event_row.claim_token = p_event_claim_token
      and event_row.claim_expires_at >= pg_catalog.now()
  ) then
    return;
  end if;

  select effect_row.*
  into v_effect
  from public.webhook_effect as effect_row
  where effect_row.id = p_effect_id
    and effect_row.webhook_event_id = p_webhook_event_id
  for update of effect_row;

  if not found then
    return;
  end if;

  if v_effect.status = 'succeeded' then
    return query select 'duplicate_succeeded'::text, v_effect.id,
      v_effect.status, null::uuid, v_effect.result,
      v_effect.provider_reference;
    return;
  end if;

  if v_effect.status in ('unknown_outcome', 'failed', 'conflict') then
    return query select v_effect.status, v_effect.id, v_effect.status,
      null::uuid, v_effect.result, v_effect.provider_reference;
    return;
  end if;

  if v_effect.status = 'processing'
     and v_effect.claim_expires_at >= pg_catalog.now() then
    return query select 'duplicate_processing'::text, v_effect.id,
      v_effect.status, null::uuid, v_effect.result,
      v_effect.provider_reference;
    return;
  end if;

  if v_effect.status = 'processing'
     and v_effect.claim_expires_at < pg_catalog.now()
     and v_effect.is_external then
    update public.webhook_effect as effect_row
    set
      status = 'unknown_outcome',
      worker_id = null,
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      last_error = 'External effect lease expired before outcome was persisted',
      updated_at = pg_catalog.now()
    where effect_row.id = v_effect.id
    returning * into v_effect;

    return query select 'unknown_outcome'::text, v_effect.id,
      v_effect.status, null::uuid, v_effect.result,
      v_effect.provider_reference;
    return;
  end if;

  if v_effect.status = 'retryable_failed'
     and v_effect.next_attempt_at > pg_catalog.now() then
    return query select 'not_due'::text, v_effect.id, v_effect.status,
      null::uuid, v_effect.result, v_effect.provider_reference;
    return;
  end if;

  update public.webhook_effect as effect_row
  set
    status = 'processing',
    attempt_count = effect_row.attempt_count + 1,
    worker_id = pg_catalog.btrim(p_worker_id),
    claim_token = gen_random_uuid(),
    claimed_at = pg_catalog.now(),
    claim_expires_at = pg_catalog.now()
      + pg_catalog.make_interval(secs => p_lease_seconds),
    last_error = null,
    updated_at = pg_catalog.now()
  where effect_row.id = v_effect.id
    and (
      effect_row.status = 'pending'
      or effect_row.status = 'retryable_failed'
      or (
        effect_row.status = 'processing'
        and not effect_row.is_external
        and effect_row.claim_expires_at < pg_catalog.now()
      )
    )
  returning * into v_effect;

  if not found then
    return;
  end if;

  return query select 'claimed'::text, v_effect.id, v_effect.status,
    v_effect.claim_token, v_effect.result, v_effect.provider_reference;
end;
$$;

create or replace function public.transition_webhook_effect(
  p_effect_id uuid,
  p_webhook_event_id uuid,
  p_organization_id integer,
  p_event_claim_token uuid,
  p_effect_claim_token uuid,
  p_status text,
  p_result jsonb default null,
  p_provider_reference text default null,
  p_last_error text default null,
  p_next_attempt_at timestamp with time zone default null
)
returns public.webhook_effect
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_effect public.webhook_effect%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'transition_webhook_effect is restricted to service_role';
  end if;

  if p_status not in (
    'succeeded', 'retryable_failed', 'unknown_outcome', 'failed'
  ) or (p_result is not null and pg_catalog.jsonb_typeof(p_result) not in ('object', 'array')) then
    raise exception using
      errcode = '22023',
      message = 'transition_webhook_effect arguments are invalid';
  end if;

  if not exists (
    select 1
    from public.webhook_event as event_row
    where event_row.id = p_webhook_event_id
      and event_row.organization_id = p_organization_id
      and event_row.status = 'processing'
      and event_row.claim_token = p_event_claim_token
      and event_row.claim_expires_at >= pg_catalog.now()
  ) then
    return v_effect;
  end if;

  update public.webhook_effect as effect_row
  set
    status = p_status,
    result = coalesce(p_result, effect_row.result),
    provider_reference = coalesce(
      nullif(pg_catalog.btrim(p_provider_reference), ''),
      effect_row.provider_reference
    ),
    last_error = case
      when p_last_error is null then null
      else pg_catalog.left(p_last_error, 1000)
    end,
    next_attempt_at = coalesce(p_next_attempt_at, effect_row.next_attempt_at),
    worker_id = null,
    claim_token = null,
    claimed_at = null,
    claim_expires_at = null,
    updated_at = pg_catalog.now()
  where effect_row.id = p_effect_id
    and effect_row.webhook_event_id = p_webhook_event_id
    and effect_row.status = 'processing'
    and effect_row.claim_token = p_effect_claim_token
    and effect_row.claim_expires_at >= pg_catalog.now()
  returning * into v_effect;

  return v_effect;
end;
$$;

create or replace function public.renew_webhook_effect_lease(
  p_effect_id uuid,
  p_webhook_event_id uuid,
  p_organization_id integer,
  p_event_claim_token uuid,
  p_effect_claim_token uuid,
  p_lease_seconds integer default 120
)
returns public.webhook_effect
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_effect public.webhook_effect%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'renew_webhook_effect_lease is restricted to service_role';
  end if;
  if p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'renew_webhook_effect_lease duration is invalid';
  end if;
  if not exists (
    select 1 from public.webhook_event as event_row
    where event_row.id = p_webhook_event_id
      and event_row.organization_id = p_organization_id
      and event_row.status = 'processing'
      and event_row.claim_token = p_event_claim_token
      and event_row.claim_expires_at >= pg_catalog.now()
  ) then
    return v_effect;
  end if;

  update public.webhook_effect as effect_row
  set claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
      updated_at = pg_catalog.now()
  where effect_row.id = p_effect_id
    and effect_row.webhook_event_id = p_webhook_event_id
    and effect_row.status = 'processing'
    and effect_row.claim_token = p_effect_claim_token
    and effect_row.claim_expires_at >= pg_catalog.now()
  returning * into v_effect;
  return v_effect;
end;
$$;

create or replace function public.register_conversation_reservation(
  p_organization_id integer,
  p_provider text,
  p_scope_id text,
  p_user_id integer,
  p_assistant_id integer,
  p_channel text,
  p_existing_thread_id integer default null
)
returns public.conversation_reservation
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_key text;
  v_provider text;
  v_scope_id text;
  v_channel text;
  v_messagebird_channel_id text;
  v_teams_tenant_id text;
  v_teams_conversation_id text;
  v_reservation public.conversation_reservation%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'register_conversation_reservation is restricted to service_role';
  end if;
  if p_organization_id is null or p_assistant_id is null
     or nullif(pg_catalog.btrim(p_provider), '') is null
     or nullif(pg_catalog.btrim(p_scope_id), '') is null
     or nullif(pg_catalog.btrim(p_channel), '') is null then
    raise exception using errcode = '22004', message = 'conversation reservation identity is incomplete';
  end if;
  v_provider := pg_catalog.lower(pg_catalog.btrim(p_provider));
  v_scope_id := pg_catalog.btrim(p_scope_id);
  v_channel := pg_catalog.btrim(p_channel);

  if v_provider not in ('messagebird', 'teams')
     or (v_provider = 'messagebird' and (v_channel <> 'whatsapp' or p_user_id is null
         or v_scope_id !~ '^channel:.+$'))
     or (v_provider = 'teams' and (v_channel <> 'teams'
         or v_scope_id !~ '^tenant:[^:]+:conversation:.+$')) then
    raise exception using errcode = '22023', message = 'conversation reservation provider scope is invalid';
  end if;

  if not exists (
    select 1 from public.assistant as assistant_row
    where assistant_row.id = p_assistant_id
      and assistant_row.organization_id = p_organization_id
  ) then
    raise exception using errcode = '23503', message = 'assistant does not belong to reservation organization';
  end if;

  if p_user_id is not null and not exists (
    select 1 from public."user" as user_row
    where user_row.id = p_user_id
      and user_row.organization_id = p_organization_id
  ) then
    raise exception using errcode = '23503', message = 'user does not belong to reservation organization';
  end if;

  if v_provider = 'teams' then
    v_teams_tenant_id := pg_catalog.substring(
      v_scope_id from '^tenant:([^:]+):conversation:.+$'
    );
    v_teams_conversation_id := pg_catalog.substring(
      v_scope_id from '^tenant:[^:]+:conversation:(.+)$'
    );
    if nullif(v_teams_tenant_id, '') is null
       or nullif(v_teams_conversation_id, '') is null then
      raise exception using errcode = '22023', message = 'Teams conversation scope is invalid';
    end if;
    if not exists (
      select 1 from public.organization as organization_row
      where organization_row.id = p_organization_id
        and organization_row.teams_tenant_id = v_teams_tenant_id
    ) then
      raise exception using errcode = '23503', message = 'Teams scope does not belong to reservation organization';
    end if;
  else
    v_messagebird_channel_id := pg_catalog.substring(
      v_scope_id from '^channel:(.+)$'
    );
    if not exists (
      select 1 from public.organization as organization_row
      where organization_row.id = p_organization_id
        and organization_row.channel_id = v_messagebird_channel_id
    ) then
      raise exception using errcode = '23503', message = 'MessageBird scope does not belong to reservation organization';
    end if;
  end if;

  v_actor_key := case when p_user_id is null then 'group' else 'user:' || p_user_id::text end;

  if p_existing_thread_id is not null and not exists (
    select 1 from public.thread as thread_row
    where thread_row.id = p_existing_thread_id
      and thread_row.assistant_id = p_assistant_id
      and thread_row.channel = pg_catalog.btrim(p_channel)
      and (
        (p_user_id is not null and thread_row.scope = 'user' and thread_row.user_id = p_user_id)
        or (p_user_id is null and thread_row.scope = 'group')
      )
      and (
        v_provider <> 'teams'
        or thread_row.external_conversation_id = v_teams_conversation_id
      )
  ) then
    raise exception using errcode = '23503', message = 'existing thread does not match reservation identity';
  end if;

  insert into public.conversation_reservation (
    organization_id, provider, scope_id, user_id, actor_key,
    assistant_id, channel, current_thread_id
  ) values (
    p_organization_id, v_provider,
    v_scope_id, p_user_id, v_actor_key,
    p_assistant_id, v_channel, p_existing_thread_id
  )
  on conflict (organization_id, provider, scope_id, actor_key, assistant_id, channel) do nothing
  returning * into v_reservation;

  if not found then
    select reservation_row.* into v_reservation
    from public.conversation_reservation as reservation_row
    where reservation_row.organization_id = p_organization_id
      and reservation_row.provider = v_provider
      and reservation_row.scope_id = v_scope_id
      and reservation_row.actor_key = v_actor_key
      and reservation_row.assistant_id = p_assistant_id
      and reservation_row.channel = v_channel
    for update of reservation_row;

    if v_reservation.current_thread_id is null
       and p_existing_thread_id is not null
       and v_reservation.status = 'ready' then
      update public.conversation_reservation as reservation_row
      set current_thread_id = p_existing_thread_id, updated_at = pg_catalog.now()
      where reservation_row.id = v_reservation.id
        and reservation_row.current_thread_id is null
        and reservation_row.status = 'ready'
      returning * into v_reservation;
    end if;
  end if;
  return v_reservation;
end;
$$;

create or replace function public.claim_conversation_reservation(
  p_reservation_id uuid,
  p_organization_id integer,
  p_lease_seconds integer default 120
)
returns table (
  outcome text,
  reservation_id uuid,
  reservation_status text,
  current_thread_id integer,
  reservation_claim_token uuid,
  claim_expires_at timestamp with time zone,
  attempt_count integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reservation public.conversation_reservation%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'claim_conversation_reservation is restricted to service_role';
  end if;
  if p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'claim_conversation_reservation duration is invalid';
  end if;

  select reservation_row.* into v_reservation
  from public.conversation_reservation as reservation_row
  where reservation_row.id = p_reservation_id
    and reservation_row.organization_id = p_organization_id
  for update of reservation_row;
  if not found then return; end if;

  if v_reservation.status = 'ready' and v_reservation.current_thread_id is not null then
    return query select 'ready'::text, v_reservation.id, v_reservation.status,
      v_reservation.current_thread_id, null::uuid, v_reservation.claim_expires_at,
      v_reservation.attempt_count;
    return;
  end if;
  if v_reservation.current_thread_id is not null
     and v_reservation.status = 'processing'
     and v_reservation.claim_expires_at < pg_catalog.now() then
    update public.conversation_reservation as reservation_row
    set status = 'ready', claim_token = null, claimed_at = null,
        claim_expires_at = null, remote_started_at = null, last_error = null,
        updated_at = pg_catalog.now()
    where reservation_row.id = v_reservation.id
    returning * into v_reservation;
    return query select 'ready'::text, v_reservation.id, v_reservation.status,
      v_reservation.current_thread_id, null::uuid, v_reservation.claim_expires_at,
      v_reservation.attempt_count;
    return;
  end if;
  if v_reservation.status in ('unknown_outcome', 'failed') then
    return query select v_reservation.status, v_reservation.id, v_reservation.status,
      v_reservation.current_thread_id, null::uuid, v_reservation.claim_expires_at,
      v_reservation.attempt_count;
    return;
  end if;
  if v_reservation.status = 'processing' and v_reservation.claim_expires_at >= pg_catalog.now() then
    return query select 'duplicate_processing'::text, v_reservation.id, v_reservation.status,
      v_reservation.current_thread_id, null::uuid, v_reservation.claim_expires_at,
      v_reservation.attempt_count;
    return;
  end if;
  if v_reservation.status = 'processing'
     and v_reservation.claim_expires_at < pg_catalog.now()
     and v_reservation.remote_started_at is not null then
    update public.conversation_reservation as reservation_row
    set status = 'unknown_outcome', claim_token = null, claimed_at = null,
        claim_expires_at = null,
        last_error = 'Remote thread creation lease expired before its outcome was persisted',
        updated_at = pg_catalog.now()
    where reservation_row.id = v_reservation.id
    returning * into v_reservation;
    return query select 'unknown_outcome'::text, v_reservation.id, v_reservation.status,
      v_reservation.current_thread_id, null::uuid, v_reservation.claim_expires_at,
      v_reservation.attempt_count;
    return;
  end if;

  update public.conversation_reservation as reservation_row
  set status = 'processing', claim_token = gen_random_uuid(), claimed_at = pg_catalog.now(),
      claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
      attempt_count = reservation_row.attempt_count + 1, remote_started_at = null,
      last_error = null, updated_at = pg_catalog.now()
  where reservation_row.id = v_reservation.id
    and (
      (reservation_row.status = 'ready' and reservation_row.current_thread_id is null)
      or reservation_row.status = 'retryable_failed'
      or (reservation_row.status = 'processing' and reservation_row.claim_expires_at < pg_catalog.now()
          and reservation_row.remote_started_at is null)
    )
  returning * into v_reservation;
  if not found then return; end if;
  return query select 'claimed'::text, v_reservation.id, v_reservation.status,
    v_reservation.current_thread_id, v_reservation.claim_token,
    v_reservation.claim_expires_at, v_reservation.attempt_count;
end;
$$;

create or replace function public.renew_conversation_reservation_lease(
  p_reservation_id uuid,
  p_organization_id integer,
  p_claim_token uuid,
  p_lease_seconds integer default 120
)
returns public.conversation_reservation
language plpgsql
security invoker
set search_path = ''
as $$
declare v_reservation public.conversation_reservation%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'renew_conversation_reservation_lease is restricted to service_role';
  end if;
  if p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'renew_conversation_reservation_lease duration is invalid';
  end if;
  update public.conversation_reservation as reservation_row
  set claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
      updated_at = pg_catalog.now()
  where reservation_row.id = p_reservation_id
    and reservation_row.organization_id = p_organization_id
    and reservation_row.status = 'processing'
    and reservation_row.claim_token = p_claim_token
    and reservation_row.claim_expires_at >= pg_catalog.now()
  returning * into v_reservation;
  return v_reservation;
end;
$$;

create or replace function public.mark_conversation_reservation_remote_started(
  p_reservation_id uuid,
  p_organization_id integer,
  p_claim_token uuid
)
returns public.conversation_reservation
language plpgsql
security invoker
set search_path = ''
as $$
declare v_reservation public.conversation_reservation%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'mark_conversation_reservation_remote_started is restricted to service_role';
  end if;
  update public.conversation_reservation as reservation_row
  set remote_started_at = coalesce(reservation_row.remote_started_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  where reservation_row.id = p_reservation_id
    and reservation_row.organization_id = p_organization_id
    and reservation_row.status = 'processing'
    and reservation_row.claim_token = p_claim_token
    and reservation_row.claim_expires_at >= pg_catalog.now()
  returning * into v_reservation;
  return v_reservation;
end;
$$;

create or replace function public.associate_conversation_reservation_thread(
  p_reservation_id uuid,
  p_organization_id integer,
  p_claim_token uuid,
  p_thread_id integer
)
returns public.conversation_reservation
language plpgsql
security invoker
set search_path = ''
as $$
declare v_reservation public.conversation_reservation%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'associate_conversation_reservation_thread is restricted to service_role';
  end if;
  update public.conversation_reservation as reservation_row
  set current_thread_id = p_thread_id, updated_at = pg_catalog.now()
  where reservation_row.id = p_reservation_id
    and reservation_row.organization_id = p_organization_id
    and reservation_row.status = 'processing'
    and reservation_row.claim_token = p_claim_token
    and reservation_row.claim_expires_at >= pg_catalog.now()
    and exists (
      select 1 from public.assistant as assistant_row
      where assistant_row.id = reservation_row.assistant_id
        and assistant_row.organization_id = reservation_row.organization_id
    )
    and (
      reservation_row.user_id is null
      or exists (
        select 1 from public."user" as user_row
        where user_row.id = reservation_row.user_id
          and user_row.organization_id = reservation_row.organization_id
      )
    )
    and exists (
      select 1 from public.thread as thread_row
      where thread_row.id = p_thread_id
        and thread_row.assistant_id = reservation_row.assistant_id
        and thread_row.channel = reservation_row.channel
        and (
          (reservation_row.user_id is not null and thread_row.scope = 'user'
           and thread_row.user_id = reservation_row.user_id)
          or (reservation_row.user_id is null and thread_row.scope = 'group')
        )
        and (
          reservation_row.provider <> 'teams'
          or (
            reservation_row.channel = 'teams'
            and reservation_row.scope_id ~ '^tenant:[^:]+:conversation:.+$'
            and thread_row.external_conversation_id = pg_catalog.substring(
              reservation_row.scope_id from '^tenant:[^:]+:conversation:(.+)$'
            )
          )
        )
    )
  returning * into v_reservation;
  return v_reservation;
end;
$$;

create or replace function public.transition_conversation_reservation(
  p_reservation_id uuid,
  p_organization_id integer,
  p_claim_token uuid,
  p_status text,
  p_last_error text default null
)
returns public.conversation_reservation
language plpgsql
security invoker
set search_path = ''
as $$
declare v_reservation public.conversation_reservation%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'transition_conversation_reservation is restricted to service_role';
  end if;
  if p_status not in ('ready', 'retryable_failed', 'unknown_outcome', 'failed') then
    raise exception using errcode = '22023', message = 'conversation reservation target status is invalid';
  end if;
  update public.conversation_reservation as reservation_row
  set status = p_status,
      claim_token = null, claimed_at = null, claim_expires_at = null,
      remote_started_at = case when p_status = 'ready' then null else reservation_row.remote_started_at end,
      last_error = case when p_last_error is null then null else pg_catalog.left(p_last_error, 1000) end,
      updated_at = pg_catalog.now()
  where reservation_row.id = p_reservation_id
    and reservation_row.organization_id = p_organization_id
    and reservation_row.status = 'processing'
    and reservation_row.claim_token = p_claim_token
    and reservation_row.claim_expires_at >= pg_catalog.now()
    and (p_status <> 'ready' or reservation_row.current_thread_id is not null)
    and (p_status <> 'retryable_failed' or reservation_row.remote_started_at is null)
  returning * into v_reservation;
  return v_reservation;
end;
$$;

create or replace function public.claim_pending_outreach_for_webhook(
  p_pending_outreach_id bigint,
  p_organization_id integer,
  p_user_id integer,
  p_webhook_event_id uuid,
  p_event_claim_token uuid,
  p_lease_seconds integer default 120
)
returns public.pending_outreach
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pending public.pending_outreach%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'claim_pending_outreach_for_webhook is restricted to service_role';
  end if;

  if p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception using
      errcode = '22023',
      message = 'claim_pending_outreach_for_webhook lease is invalid';
  end if;

  if not exists (
    select 1
    from public.webhook_event as event_row
    where event_row.id = p_webhook_event_id
      and event_row.organization_id = p_organization_id
      and event_row.status = 'processing'
      and event_row.claim_token = p_event_claim_token
      and event_row.claim_expires_at >= pg_catalog.now()
  ) then
    return v_pending;
  end if;

  -- A lease that expired after the external send began has an unknown outcome.
  -- Do not hand it to another worker for an automatic resend.
  update public.pending_outreach as pending_row
  set
    status = 'unknown_outcome',
    claim_token = null,
    claimed_at = null,
    claim_expires_at = null,
    last_error = 'Pending outreach send lease expired before its outcome was persisted'
  where pending_row.id = p_pending_outreach_id
    and pending_row.org_id = p_organization_id
    and pending_row.user_id = p_user_id
    and pending_row.status = 'processing'
    and pending_row.claim_expires_at < pg_catalog.now()
    and pending_row.send_started_at is not null;

  if found then
    return v_pending;
  end if;

  update public.pending_outreach as pending_row
  set
    status = 'processing',
    attempt_count = pending_row.attempt_count + 1,
    claim_token = gen_random_uuid(),
    claimed_at = pg_catalog.now(),
    claim_expires_at = pg_catalog.now()
      + pg_catalog.make_interval(secs => p_lease_seconds),
    webhook_event_id = p_webhook_event_id,
    send_started_at = null,
    last_error = null
  where pending_row.id = p_pending_outreach_id
    and pending_row.org_id = p_organization_id
    and pending_row.user_id = p_user_id
    and pending_row.expires_at > pg_catalog.now()
    and (
      pending_row.status = 'pending'
      or (
        pending_row.status = 'retryable_failed'
        and pending_row.next_attempt_at <= pg_catalog.now()
      )
      or (
        pending_row.status = 'processing'
        and pending_row.claim_expires_at < pg_catalog.now()
        and pending_row.send_started_at is null
      )
    )
  returning * into v_pending;

  return v_pending;
end;
$$;

create or replace function public.renew_pending_outreach_for_webhook(
  p_pending_outreach_id bigint,
  p_organization_id integer,
  p_user_id integer,
  p_webhook_event_id uuid,
  p_event_claim_token uuid,
  p_claim_token uuid,
  p_lease_seconds integer default 120
)
returns public.pending_outreach
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pending public.pending_outreach%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'renew_pending_outreach_for_webhook is restricted to service_role';
  end if;
  if p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'renew_pending_outreach_for_webhook lease is invalid';
  end if;
  if not exists (
    select 1 from public.webhook_event as event_row
    where event_row.id = p_webhook_event_id
      and event_row.organization_id = p_organization_id
      and event_row.status = 'processing'
      and event_row.claim_token = p_event_claim_token
      and event_row.claim_expires_at >= pg_catalog.now()
  ) then
    return v_pending;
  end if;

  update public.pending_outreach as pending_row
  set claim_expires_at = pg_catalog.now()
        + pg_catalog.make_interval(secs => p_lease_seconds)
  where pending_row.id = p_pending_outreach_id
    and pending_row.org_id = p_organization_id
    and pending_row.user_id = p_user_id
    and pending_row.webhook_event_id = p_webhook_event_id
    and pending_row.status = 'processing'
    and pending_row.claim_token = p_claim_token
    and pending_row.claim_expires_at >= pg_catalog.now()
  returning * into v_pending;
  return v_pending;
end;
$$;

create or replace function public.mark_pending_outreach_send_started(
  p_pending_outreach_id bigint,
  p_organization_id integer,
  p_user_id integer,
  p_webhook_event_id uuid,
  p_event_claim_token uuid,
  p_claim_token uuid
)
returns public.pending_outreach
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pending public.pending_outreach%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'mark_pending_outreach_send_started is restricted to service_role';
  end if;
  if not exists (
    select 1 from public.webhook_event as event_row
    where event_row.id = p_webhook_event_id
      and event_row.organization_id = p_organization_id
      and event_row.status = 'processing'
      and event_row.claim_token = p_event_claim_token
      and event_row.claim_expires_at >= pg_catalog.now()
  ) then
    return v_pending;
  end if;

  update public.pending_outreach as pending_row
  set send_started_at = coalesce(pending_row.send_started_at, pg_catalog.now())
  where pending_row.id = p_pending_outreach_id
    and pending_row.org_id = p_organization_id
    and pending_row.user_id = p_user_id
    and pending_row.webhook_event_id = p_webhook_event_id
    and pending_row.status = 'processing'
    and pending_row.claim_token = p_claim_token
    and pending_row.claim_expires_at >= pg_catalog.now()
  returning * into v_pending;
  return v_pending;
end;
$$;

create or replace function public.transition_pending_outreach_for_webhook(
  p_pending_outreach_id bigint,
  p_organization_id integer,
  p_user_id integer,
  p_webhook_event_id uuid,
  p_event_claim_token uuid,
  p_claim_token uuid,
  p_status text,
  p_reply_message_id text default null,
  p_last_error text default null,
  p_next_attempt_at timestamp with time zone default null
)
returns public.pending_outreach
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pending public.pending_outreach%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'transition_pending_outreach_for_webhook is restricted to service_role';
  end if;

  if p_status not in ('replied', 'retryable_failed', 'unknown_outcome', 'failed') then
    raise exception using
      errcode = '22023',
      message = 'transition_pending_outreach_for_webhook target status is invalid';
  end if;

  if not exists (
    select 1
    from public.webhook_event as event_row
    where event_row.id = p_webhook_event_id
      and event_row.organization_id = p_organization_id
      and event_row.status = 'processing'
      and event_row.claim_token = p_event_claim_token
      and event_row.claim_expires_at >= pg_catalog.now()
  ) then
    return v_pending;
  end if;

  update public.pending_outreach as pending_row
  set
    status = p_status,
    reply_message_id = case
      when p_status = 'replied' then p_reply_message_id
      else pending_row.reply_message_id
    end,
    next_attempt_at = coalesce(p_next_attempt_at, pending_row.next_attempt_at),
    last_error = case
      when p_last_error is null then null
      else pg_catalog.left(p_last_error, 1000)
    end,
    claim_token = null,
    claimed_at = null,
    claim_expires_at = null,
    send_started_at = case
      when p_status = 'unknown_outcome' then pending_row.send_started_at
      else null
    end
  where pending_row.id = p_pending_outreach_id
    and pending_row.org_id = p_organization_id
    and pending_row.user_id = p_user_id
    and pending_row.webhook_event_id = p_webhook_event_id
    and pending_row.status = 'processing'
    and pending_row.claim_token = p_claim_token
    and pending_row.claim_expires_at >= pg_catalog.now()
  returning * into v_pending;

  return v_pending;
end;
$$;

alter table public.webhook_event enable row level security;
alter table public.webhook_effect enable row level security;
alter table public.conversation_reservation enable row level security;

revoke all privileges on table public.webhook_event from public, anon, authenticated;
revoke all privileges on table public.webhook_effect from public, anon, authenticated;
revoke all privileges on table public.conversation_reservation from public, anon, authenticated;
grant select, insert, update on table public.webhook_event to service_role;
grant select, insert, update on table public.webhook_effect to service_role;
grant select, insert, update on table public.conversation_reservation to service_role;
grant select, update on table public.pending_outreach to service_role;

-- Convert only effective pre-existing browser privileges to column grants. This
-- prevents the two new internal columns from inheriting a table-level grant and
-- never grants a capability that the role did not already have.
do $$
declare
  v_role text;
  v_privilege text;
  v_columns text;
begin
  revoke select, insert, update, references on table public.message from public;

  foreach v_role in array array['anon', 'authenticated'] loop
    foreach v_privilege in array array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] loop
      select pg_catalog.string_agg(
        pg_catalog.quote_ident(column_row.attname), ', ' order by column_row.attnum
      )
      into v_columns
      from pg_catalog.pg_attribute as column_row
      where column_row.attrelid = 'public.message'::regclass
        and column_row.attnum > 0
        and not column_row.attisdropped
        and column_row.attname not in ('webhook_event_id', 'webhook_effect_key')
        and pg_catalog.has_column_privilege(
          v_role, 'public.message'::regclass, column_row.attnum, v_privilege
        );

      execute pg_catalog.format(
        'revoke %s on table public.message from %I', v_privilege, v_role
      );
      if v_columns is not null then
        execute pg_catalog.format(
          'grant %s (%s) on table public.message to %I',
          v_privilege, v_columns, v_role
        );
      end if;
    end loop;
  end loop;
end
$$;

revoke select, insert, update, references (
  webhook_event_id, webhook_effect_key
) on public.message from public, anon, authenticated;
revoke select, insert, update, references (
  attempt_count, claimed_at, claim_expires_at, next_attempt_at, claim_token,
  webhook_event_id, send_started_at, last_error
) on public.pending_outreach from public, anon, authenticated;

revoke all privileges on function public.register_webhook_event(
  text, integer, text, text, text, text, jsonb
) from public, anon, authenticated;
revoke all privileges on function public.claim_webhook_events(
  text, integer, integer
) from public, anon, authenticated;
revoke all privileges on function public.transition_webhook_event(
  uuid, integer, uuid, text, text, timestamp with time zone
) from public, anon, authenticated;
revoke all privileges on function public.renew_webhook_event_lease(
  uuid, integer, uuid, integer
) from public, anon, authenticated;
revoke all privileges on function public.register_webhook_effect(
  uuid, integer, uuid, text, text, boolean, text
) from public, anon, authenticated;
revoke all privileges on function public.claim_webhook_effect(
  uuid, uuid, integer, uuid, text, integer
) from public, anon, authenticated;
revoke all privileges on function public.transition_webhook_effect(
  uuid, uuid, integer, uuid, uuid, text, jsonb, text, text,
  timestamp with time zone
) from public, anon, authenticated;
revoke all privileges on function public.renew_webhook_effect_lease(
  uuid, uuid, integer, uuid, uuid, integer
) from public, anon, authenticated;
revoke all privileges on function public.register_conversation_reservation(
  integer, text, text, integer, integer, text, integer
) from public, anon, authenticated;
revoke all privileges on function public.claim_conversation_reservation(
  uuid, integer, integer
) from public, anon, authenticated;
revoke all privileges on function public.renew_conversation_reservation_lease(
  uuid, integer, uuid, integer
) from public, anon, authenticated;
revoke all privileges on function public.mark_conversation_reservation_remote_started(
  uuid, integer, uuid
) from public, anon, authenticated;
revoke all privileges on function public.associate_conversation_reservation_thread(
  uuid, integer, uuid, integer
) from public, anon, authenticated;
revoke all privileges on function public.transition_conversation_reservation(
  uuid, integer, uuid, text, text
) from public, anon, authenticated;
  revoke all privileges on function public.claim_pending_outreach_for_webhook(
  bigint, integer, integer, uuid, uuid, integer
  ) from public, anon, authenticated;
  revoke all privileges on function public.renew_pending_outreach_for_webhook(
  bigint, integer, integer, uuid, uuid, uuid, integer
  ) from public, anon, authenticated;
  revoke all privileges on function public.mark_pending_outreach_send_started(
  bigint, integer, integer, uuid, uuid, uuid
  ) from public, anon, authenticated;
  revoke all privileges on function public.transition_pending_outreach_for_webhook(
  bigint, integer, integer, uuid, uuid, uuid, text, text, text,
  timestamp with time zone
) from public, anon, authenticated;

grant execute on function public.register_webhook_event(
  text, integer, text, text, text, text, jsonb
) to service_role;
grant execute on function public.claim_webhook_events(
  text, integer, integer
) to service_role;
grant execute on function public.transition_webhook_event(
  uuid, integer, uuid, text, text, timestamp with time zone
) to service_role;
grant execute on function public.renew_webhook_event_lease(
  uuid, integer, uuid, integer
) to service_role;
grant execute on function public.register_webhook_effect(
  uuid, integer, uuid, text, text, boolean, text
) to service_role;
grant execute on function public.claim_webhook_effect(
  uuid, uuid, integer, uuid, text, integer
) to service_role;
grant execute on function public.transition_webhook_effect(
  uuid, uuid, integer, uuid, uuid, text, jsonb, text, text,
  timestamp with time zone
) to service_role;
grant execute on function public.renew_webhook_effect_lease(
  uuid, uuid, integer, uuid, uuid, integer
) to service_role;
grant execute on function public.register_conversation_reservation(
  integer, text, text, integer, integer, text, integer
) to service_role;
grant execute on function public.claim_conversation_reservation(
  uuid, integer, integer
) to service_role;
grant execute on function public.renew_conversation_reservation_lease(
  uuid, integer, uuid, integer
) to service_role;
grant execute on function public.mark_conversation_reservation_remote_started(
  uuid, integer, uuid
) to service_role;
grant execute on function public.associate_conversation_reservation_thread(
  uuid, integer, uuid, integer
) to service_role;
grant execute on function public.transition_conversation_reservation(
  uuid, integer, uuid, text, text
) to service_role;
  grant execute on function public.claim_pending_outreach_for_webhook(
  bigint, integer, integer, uuid, uuid, integer
  ) to service_role;
  grant execute on function public.renew_pending_outreach_for_webhook(
  bigint, integer, integer, uuid, uuid, uuid, integer
  ) to service_role;
  grant execute on function public.mark_pending_outreach_send_started(
  bigint, integer, integer, uuid, uuid, uuid
  ) to service_role;
  grant execute on function public.transition_pending_outreach_for_webhook(
  bigint, integer, integer, uuid, uuid, uuid, text, text, text,
  timestamp with time zone
) to service_role;

do $$
declare
  v_function regprocedure;
  v_table regclass;
  v_role text;
  v_privilege text;
  v_column text;
  v_functions regprocedure[] := array[
    'public.register_webhook_event(text,integer,text,text,text,text,jsonb)'::regprocedure,
    'public.claim_webhook_events(text,integer,integer)'::regprocedure,
    'public.transition_webhook_event(uuid,integer,uuid,text,text,timestamp with time zone)'::regprocedure,
    'public.renew_webhook_event_lease(uuid,integer,uuid,integer)'::regprocedure,
    'public.register_webhook_effect(uuid,integer,uuid,text,text,boolean,text)'::regprocedure,
    'public.claim_webhook_effect(uuid,uuid,integer,uuid,text,integer)'::regprocedure,
    'public.transition_webhook_effect(uuid,uuid,integer,uuid,uuid,text,jsonb,text,text,timestamp with time zone)'::regprocedure,
    'public.renew_webhook_effect_lease(uuid,uuid,integer,uuid,uuid,integer)'::regprocedure,
    'public.register_conversation_reservation(integer,text,text,integer,integer,text,integer)'::regprocedure,
    'public.claim_conversation_reservation(uuid,integer,integer)'::regprocedure,
    'public.renew_conversation_reservation_lease(uuid,integer,uuid,integer)'::regprocedure,
    'public.mark_conversation_reservation_remote_started(uuid,integer,uuid)'::regprocedure,
    'public.associate_conversation_reservation_thread(uuid,integer,uuid,integer)'::regprocedure,
    'public.transition_conversation_reservation(uuid,integer,uuid,text,text)'::regprocedure,
    'public.claim_pending_outreach_for_webhook(bigint,integer,integer,uuid,uuid,integer)'::regprocedure,
    'public.renew_pending_outreach_for_webhook(bigint,integer,integer,uuid,uuid,uuid,integer)'::regprocedure,
    'public.mark_pending_outreach_send_started(bigint,integer,integer,uuid,uuid,uuid)'::regprocedure,
    'public.transition_pending_outreach_for_webhook(bigint,integer,integer,uuid,uuid,uuid,text,text,text,timestamp with time zone)'::regprocedure
  ];
begin
  foreach v_function in array v_functions loop
    if exists (
      select 1
      from pg_catalog.pg_proc as procedure_row
      cross join lateral pg_catalog.aclexplode(
        coalesce(
          procedure_row.proacl,
          pg_catalog.acldefault('f', procedure_row.proowner)
        )
      ) as function_acl
      where procedure_row.oid = v_function
        and function_acl.grantee = 0
        and function_acl.privilege_type = 'EXECUTE'
    ) or pg_catalog.has_function_privilege('anon', v_function, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', v_function, 'EXECUTE') then
      raise exception using
        errcode = '42501',
        message = 'Webhook processing validation failed: browser role can execute an internal RPC';
    end if;

    if not pg_catalog.has_function_privilege(
      'service_role', v_function, 'EXECUTE'
    ) then
      raise exception using
        errcode = '42501',
        message = 'Webhook processing validation failed: service_role cannot execute an internal RPC';
    end if;
  end loop;

  foreach v_table in array array[
    'public.webhook_event'::regclass,
    'public.webhook_effect'::regclass,
    'public.conversation_reservation'::regclass
  ] loop
    if exists (
      select 1
      from pg_catalog.pg_class as table_row
      cross join lateral pg_catalog.aclexplode(
        coalesce(table_row.relacl, pg_catalog.acldefault('r', table_row.relowner))
      ) as table_acl
      where table_row.oid = v_table
        and table_acl.grantee = 0
        and table_acl.privilege_type in (
          'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
        )
    ) then
      raise exception using errcode = '42501', message = 'Webhook processing validation failed: PUBLIC has a new-table privilege';
    end if;

    foreach v_role in array array['anon', 'authenticated'] loop
      foreach v_privilege in array array[
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
      ] loop
        if pg_catalog.has_table_privilege(v_role, v_table, v_privilege) then
          raise exception using errcode = '42501', message = 'Webhook processing validation failed: browser role has a new-table privilege';
        end if;
      end loop;
    end loop;
  end loop;

  foreach v_role in array array['anon', 'authenticated'] loop
    foreach v_column in array array['webhook_event_id', 'webhook_effect_key'] loop
      foreach v_privilege in array array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] loop
        if pg_catalog.has_column_privilege(v_role, 'public.message', v_column, v_privilege) then
          raise exception using errcode = '42501', message = 'Webhook processing validation failed: browser role can access an internal message column';
        end if;
      end loop;
    end loop;
    foreach v_column in array array[
      'status', 'attempt_count', 'claimed_at', 'claim_expires_at', 'next_attempt_at',
      'claim_token', 'webhook_event_id', 'send_started_at', 'last_error'
    ] loop
      foreach v_privilege in array array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] loop
        if pg_catalog.has_column_privilege(v_role, 'public.pending_outreach', v_column, v_privilege) then
          raise exception using errcode = '42501', message = 'Webhook processing validation failed: browser role can access an internal pending outreach column';
        end if;
      end loop;
    end loop;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_attribute as column_row
    cross join lateral pg_catalog.aclexplode(column_row.attacl) as column_acl
    where column_row.attrelid in (
      'public.message'::regclass, 'public.pending_outreach'::regclass
    )
      and column_row.attname in (
        'webhook_event_id', 'webhook_effect_key', 'status', 'attempt_count',
        'claimed_at', 'claim_expires_at', 'next_attempt_at', 'claim_token',
        'send_started_at', 'last_error'
      )
      and column_acl.grantee = 0
      and column_acl.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
  ) then
    raise exception using errcode = '42501', message = 'Webhook processing validation failed: PUBLIC can access an internal column';
  end if;

  if not pg_catalog.has_table_privilege(
    'service_role', 'public.webhook_event', 'SELECT,INSERT,UPDATE'
  ) or not pg_catalog.has_table_privilege(
    'service_role', 'public.webhook_effect', 'SELECT,INSERT,UPDATE'
  ) or not pg_catalog.has_table_privilege(
    'service_role', 'public.conversation_reservation', 'SELECT,INSERT,UPDATE'
  ) then
    raise exception using
      errcode = '42501',
      message = 'Webhook processing validation failed: service_role lacks inbox/outbox privileges';
  end if;
end
$$;

commit;
