-- Functional delivery claims for read-chain sends. The existing unique identity
-- (chain_recipient_id, step_index) is the canonical delivery identity.

begin;

alter table public.message_chain_delivery
  add column if not exists claim_token uuid null,
  add column if not exists claimed_at timestamp with time zone null,
  add column if not exists claim_expires_at timestamp with time zone null,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists send_started_at timestamp with time zone null,
  add column if not exists last_error text null,
  add column if not exists claim_protocol_started_at timestamp with time zone null,
  add column if not exists worker_id text null,
  add column if not exists provider_message_id text null;

alter table public.message_chain_delivery
  drop constraint if exists message_chain_delivery_status_check,
  add constraint message_chain_delivery_status_check check (
    status in (
      'queued', 'scheduled', 'processing', 'sent', 'read', 'failed',
      'skipped', 'unknown_outcome'
    )
  );

create index if not exists message_chain_delivery_claim_due_idx
  on public.message_chain_delivery (status, claim_expires_at, due_at, id);

create or replace function public.ensure_message_chain_delivery(
  p_organization_id integer,
  p_chain_id uuid,
  p_chain_step_id uuid,
  p_chain_recipient_id uuid,
  p_user_id integer,
  p_step_index integer,
  p_initial_status text default 'queued',
  p_due_at timestamp with time zone default null
)
returns public.message_chain_delivery
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_delivery public.message_chain_delivery%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'ensure_message_chain_delivery is restricted to service_role';
  end if;

  if p_organization_id is null or p_chain_id is null or p_chain_step_id is null
     or p_chain_recipient_id is null or p_user_id is null or p_step_index is null
     or p_step_index < 1 or p_initial_status not in ('queued', 'scheduled') then
    raise exception using errcode = '22023', message = 'message chain delivery context is invalid';
  end if;

  if p_initial_status = 'scheduled' and p_due_at is null then
    raise exception using errcode = '22023', message = 'scheduled delivery requires due_at';
  end if;

  if not exists (
    select 1
    from public.message_chain as chain_row
    join public.message_chain_recipient as recipient_row
      on recipient_row.id = p_chain_recipient_id
      and recipient_row.chain_id = chain_row.id
      and recipient_row.user_id = p_user_id
    join public.message_chain_step as step_row
      on step_row.id = p_chain_step_id
      and step_row.chain_id = chain_row.id
      and step_row.step_index = p_step_index
    where chain_row.id = p_chain_id
      and chain_row.organization_id = p_organization_id
  ) then
    raise exception using errcode = '42501', message = 'message chain delivery ownership is invalid';
  end if;

  insert into public.message_chain_delivery (
    chain_id, chain_step_id, chain_recipient_id, user_id, step_index, status,
    due_at, updated_at
  ) values (
    p_chain_id, p_chain_step_id, p_chain_recipient_id, p_user_id, p_step_index,
    p_initial_status, p_due_at, pg_catalog.now()
  )
  on conflict (chain_recipient_id, step_index) do nothing
  returning * into v_delivery;

  if found then
    return v_delivery;
  end if;

  select delivery_row.*
  into v_delivery
  from public.message_chain_delivery as delivery_row
  where delivery_row.chain_recipient_id = p_chain_recipient_id
    and delivery_row.step_index = p_step_index
  for update of delivery_row;

  if not found
     or v_delivery.chain_id <> p_chain_id
     or v_delivery.chain_step_id <> p_chain_step_id
     or v_delivery.user_id <> p_user_id then
    raise exception using errcode = '23505', message = 'delivery functional identity conflicts with chain context';
  end if;

  return v_delivery;
end;
$$;

create or replace function public.claim_message_chain_delivery(
  p_delivery_id uuid,
  p_organization_id integer,
  p_chain_id uuid,
  p_chain_step_id uuid,
  p_chain_recipient_id uuid,
  p_user_id integer,
  p_worker_id text,
  p_lease_seconds integer default 120
)
returns table (
  outcome text,
  delivery_id uuid,
  delivery_status text,
  claim_token uuid,
  claim_expires_at timestamp with time zone,
  send_started_at timestamp with time zone,
  provider_message_id text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_delivery public.message_chain_delivery%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'claim_message_chain_delivery is restricted to service_role';
  end if;

  if p_delivery_id is null or p_organization_id is null or p_chain_id is null
     or p_chain_step_id is null or p_chain_recipient_id is null or p_user_id is null
     or nullif(pg_catalog.btrim(p_worker_id), '') is null
     or p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'message chain delivery claim arguments are invalid';
  end if;

  select delivery_row.*
  into v_delivery
  from public.message_chain_delivery as delivery_row
  join public.message_chain as chain_row on chain_row.id = delivery_row.chain_id
  join public.message_chain_recipient as recipient_row on recipient_row.id = delivery_row.chain_recipient_id
  join public.message_chain_step as step_row on step_row.id = delivery_row.chain_step_id
  where delivery_row.id = p_delivery_id
    and delivery_row.chain_id = p_chain_id
    and delivery_row.chain_step_id = p_chain_step_id
    and delivery_row.chain_recipient_id = p_chain_recipient_id
    and delivery_row.user_id = p_user_id
    and chain_row.organization_id = p_organization_id
    and recipient_row.chain_id = chain_row.id
    and recipient_row.user_id = p_user_id
    and step_row.chain_id = chain_row.id
    and step_row.step_index = delivery_row.step_index
  for update of delivery_row;

  if not found then
    raise exception using errcode = '42501', message = 'message chain delivery claim ownership is invalid';
  end if;

  if v_delivery.status in ('sent', 'read', 'skipped', 'unknown_outcome') then
    return query select 'terminal'::text, v_delivery.id, v_delivery.status,
      null::uuid, null::timestamp with time zone, v_delivery.send_started_at,
      v_delivery.provider_message_id;
    return;
  end if;

  -- Rows that existed before this migration have no protocol marker. Never
  -- infer that a historic failed/processing delivery is safe to resend.
  if v_delivery.status in ('failed', 'processing')
     and v_delivery.claim_protocol_started_at is null then
    return query select 'legacy_unmanaged'::text, v_delivery.id,
      v_delivery.status, null::uuid, null::timestamp with time zone,
      v_delivery.send_started_at, v_delivery.provider_message_id;
    return;
  end if;

  if v_delivery.status = 'processing'
     and v_delivery.claim_expires_at >= pg_catalog.now() then
    return query select 'duplicate_processing'::text, v_delivery.id,
      v_delivery.status, null::uuid, v_delivery.claim_expires_at,
      v_delivery.send_started_at, v_delivery.provider_message_id;
    return;
  end if;

  if v_delivery.status = 'processing'
     and v_delivery.claim_expires_at < pg_catalog.now()
     and v_delivery.send_started_at is not null then
    update public.message_chain_delivery as delivery_row
    set status = 'unknown_outcome', claim_token = null, claimed_at = null,
        claim_expires_at = null, worker_id = null,
        last_error = 'Delivery lease expired after external send started',
        error = 'Delivery lease expired after external send started',
        updated_at = pg_catalog.now()
    where delivery_row.id = v_delivery.id
    returning * into v_delivery;

    return query select 'unknown_outcome'::text, v_delivery.id,
      v_delivery.status, null::uuid, null::timestamp with time zone,
      v_delivery.send_started_at, v_delivery.provider_message_id;
    return;
  end if;

  if v_delivery.status = 'scheduled'
     and (v_delivery.due_at is null or v_delivery.due_at > pg_catalog.now()) then
    return query select 'not_due'::text, v_delivery.id, v_delivery.status,
      null::uuid, null::timestamp with time zone, v_delivery.send_started_at,
      v_delivery.provider_message_id;
    return;
  end if;

  if v_delivery.status = 'failed' and v_delivery.send_started_at is not null then
    return query select 'terminal'::text, v_delivery.id, v_delivery.status,
      null::uuid, null::timestamp with time zone, v_delivery.send_started_at,
      v_delivery.provider_message_id;
    return;
  end if;

  if v_delivery.status not in ('queued', 'scheduled', 'failed', 'processing') then
    return query select 'terminal'::text, v_delivery.id, v_delivery.status,
      null::uuid, null::timestamp with time zone, v_delivery.send_started_at,
      v_delivery.provider_message_id;
    return;
  end if;

  update public.message_chain_delivery as delivery_row
  set status = 'processing', attempt_count = delivery_row.attempt_count + 1,
      claim_token = pg_catalog.gen_random_uuid(), claimed_at = pg_catalog.now(),
      claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
      claim_protocol_started_at = coalesce(delivery_row.claim_protocol_started_at, pg_catalog.now()),
      worker_id = pg_catalog.btrim(p_worker_id),
      failed_at = case when delivery_row.send_started_at is null then null else delivery_row.failed_at end,
      error = case when delivery_row.send_started_at is null then null else delivery_row.error end,
      last_error = null, updated_at = pg_catalog.now()
  where delivery_row.id = v_delivery.id
  returning * into v_delivery;

  return query select 'claimed'::text, v_delivery.id, v_delivery.status,
    v_delivery.claim_token, v_delivery.claim_expires_at,
    v_delivery.send_started_at, v_delivery.provider_message_id;
end;
$$;

create or replace function public.renew_message_chain_delivery_lease(
  p_delivery_id uuid,
  p_organization_id integer,
  p_claim_token uuid,
  p_lease_seconds integer default 120
)
returns public.message_chain_delivery
language plpgsql
security invoker
set search_path = ''
as $$
declare v_delivery public.message_chain_delivery%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'renew_message_chain_delivery_lease is restricted to service_role';
  end if;
  if p_delivery_id is null or p_organization_id is null or p_claim_token is null
     or p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'message chain delivery lease arguments are invalid';
  end if;
  update public.message_chain_delivery as delivery_row
  set claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
      updated_at = pg_catalog.now()
  from public.message_chain as chain_row
  where delivery_row.id = p_delivery_id
    and delivery_row.chain_id = chain_row.id
    and chain_row.organization_id = p_organization_id
    and delivery_row.status = 'processing'
    and delivery_row.claim_token = p_claim_token
    and delivery_row.claim_expires_at >= pg_catalog.now()
  returning delivery_row.* into v_delivery;
  return v_delivery;
end;
$$;

create or replace function public.mark_message_chain_delivery_send_started(
  p_delivery_id uuid,
  p_organization_id integer,
  p_claim_token uuid
)
returns public.message_chain_delivery
language plpgsql
security invoker
set search_path = ''
as $$
declare v_delivery public.message_chain_delivery%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'mark_message_chain_delivery_send_started is restricted to service_role';
  end if;
  update public.message_chain_delivery as delivery_row
  set send_started_at = coalesce(delivery_row.send_started_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  from public.message_chain as chain_row
  where delivery_row.id = p_delivery_id
    and delivery_row.chain_id = chain_row.id
    and chain_row.organization_id = p_organization_id
    and delivery_row.status = 'processing'
    and delivery_row.claim_token = p_claim_token
    and delivery_row.claim_expires_at >= pg_catalog.now()
  returning delivery_row.* into v_delivery;
  return v_delivery;
end;
$$;

create or replace function public.complete_message_chain_delivery_send(
  p_delivery_id uuid,
  p_organization_id integer,
  p_claim_token uuid,
  p_message_id integer,
  p_provider_message_id text default null
)
returns public.message_chain_delivery
language plpgsql
security invoker
set search_path = ''
as $$
declare v_delivery public.message_chain_delivery%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'complete_message_chain_delivery_send is restricted to service_role';
  end if;
  if p_message_id is null then
    raise exception using errcode = '22023', message = 'complete_message_chain_delivery_send requires message_id';
  end if;

  select delivery_row.* into v_delivery
  from public.message_chain_delivery as delivery_row
  join public.message_chain as chain_row on chain_row.id = delivery_row.chain_id
  where delivery_row.id = p_delivery_id
    and chain_row.organization_id = p_organization_id
    and delivery_row.status = 'processing'
    and delivery_row.claim_token = p_claim_token
    and delivery_row.claim_expires_at >= pg_catalog.now()
  for update of delivery_row;

  if not found then return v_delivery; end if;

  if not exists (
    select 1
    from public.message as message_row
    where message_row.id = p_message_id
      and message_row.organization_id = p_organization_id
      and message_row.user_id = v_delivery.user_id
      and message_row.message_chain_id = v_delivery.chain_id
       and message_row.message_chain_step_id = v_delivery.chain_step_id
       and message_row.message_chain_recipient_id = v_delivery.chain_recipient_id
       and message_row.message_chain_step_index = v_delivery.step_index
       and (
        nullif(pg_catalog.btrim(p_provider_message_id), '') is null
        or v_delivery.provider_message_id is null
        or v_delivery.provider_message_id = nullif(pg_catalog.btrim(p_provider_message_id), '')
      )
      and (
        coalesce(nullif(pg_catalog.btrim(p_provider_message_id), ''), v_delivery.provider_message_id) is null
        or message_row.message_id is null
        or message_row.message_id = coalesce(nullif(pg_catalog.btrim(p_provider_message_id), ''), v_delivery.provider_message_id)
      )
  ) then
    raise exception using errcode = '42501', message = 'message does not match message chain delivery context';
  end if;

  update public.message_chain_delivery as delivery_row
  set status = 'sent', message_id = coalesce(p_message_id, delivery_row.message_id),
      provider_message_id = coalesce(nullif(pg_catalog.btrim(p_provider_message_id), ''), delivery_row.provider_message_id),
      sent_at = coalesce(delivery_row.sent_at, pg_catalog.now()),
      claim_token = null, claimed_at = null, claim_expires_at = null,
      worker_id = null, failed_at = null,
      last_error = null, error = null, updated_at = pg_catalog.now()
  where delivery_row.id = v_delivery.id
    and delivery_row.claim_token = p_claim_token
    and delivery_row.status = 'processing'
  returning * into v_delivery;

  if not found then return v_delivery; end if;

  update public.message_chain_recipient as recipient_row
  set current_step_index = greatest(recipient_row.current_step_index, v_delivery.step_index),
      status = case when recipient_row.status = 'active' then 'active' else recipient_row.status end,
      updated_at = pg_catalog.now()
  where recipient_row.id = v_delivery.chain_recipient_id
    and recipient_row.chain_id = v_delivery.chain_id
    and recipient_row.user_id = v_delivery.user_id;

  return v_delivery;
end;
$$;

create or replace function public.fail_message_chain_delivery_before_send(
  p_delivery_id uuid,
  p_organization_id integer,
  p_claim_token uuid,
  p_last_error text default null
)
returns public.message_chain_delivery
language plpgsql
security invoker
set search_path = ''
as $$
declare v_delivery public.message_chain_delivery%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'fail_message_chain_delivery_before_send is restricted to service_role';
  end if;
  update public.message_chain_delivery as delivery_row
  set status = 'failed', failed_at = pg_catalog.now(),
      last_error = pg_catalog.left(coalesce(p_last_error, 'Send failed before external request'), 1000),
      error = pg_catalog.left(coalesce(p_last_error, 'Send failed before external request'), 1000),
      claim_token = null, claimed_at = null, claim_expires_at = null,
      worker_id = null,
      updated_at = pg_catalog.now()
  from public.message_chain as chain_row
  where delivery_row.id = p_delivery_id
    and delivery_row.chain_id = chain_row.id
    and chain_row.organization_id = p_organization_id
    and delivery_row.status = 'processing'
    and delivery_row.claim_token = p_claim_token
    and delivery_row.claim_expires_at >= pg_catalog.now()
    and delivery_row.send_started_at is null
  returning delivery_row.* into v_delivery;
  return v_delivery;
end;
$$;

create or replace function public.fail_message_chain_delivery_after_send(
  p_delivery_id uuid,
  p_organization_id integer,
  p_claim_token uuid,
  p_last_error text default null,
  p_provider_message_id text default null
)
returns public.message_chain_delivery
language plpgsql
security invoker
set search_path = ''
as $$
declare v_delivery public.message_chain_delivery%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'fail_message_chain_delivery_after_send is restricted to service_role';
  end if;
  update public.message_chain_delivery as delivery_row
  set status = 'failed', failed_at = pg_catalog.now(),
      provider_message_id = coalesce(nullif(pg_catalog.btrim(p_provider_message_id), ''), delivery_row.provider_message_id),
      last_error = pg_catalog.left(coalesce(p_last_error, 'Provider rejected request'), 1000),
      error = pg_catalog.left(coalesce(p_last_error, 'Provider rejected request'), 1000),
      claim_token = null, claimed_at = null, claim_expires_at = null,
      worker_id = null,
      updated_at = pg_catalog.now()
  from public.message_chain as chain_row
  where delivery_row.id = p_delivery_id
    and delivery_row.chain_id = chain_row.id
    and chain_row.organization_id = p_organization_id
    and delivery_row.status = 'processing'
    and delivery_row.claim_token = p_claim_token
    and delivery_row.claim_expires_at >= pg_catalog.now()
    and delivery_row.send_started_at is not null
  returning delivery_row.* into v_delivery;
  return v_delivery;
end;
$$;

create or replace function public.mark_message_chain_delivery_unknown_outcome(
  p_delivery_id uuid,
  p_organization_id integer,
  p_claim_token uuid,
  p_last_error text default null,
  p_provider_message_id text default null
)
returns public.message_chain_delivery
language plpgsql
security invoker
set search_path = ''
as $$
declare v_delivery public.message_chain_delivery%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'mark_message_chain_delivery_unknown_outcome is restricted to service_role';
  end if;
  update public.message_chain_delivery as delivery_row
  set status = 'unknown_outcome',
      provider_message_id = coalesce(nullif(pg_catalog.btrim(p_provider_message_id), ''), delivery_row.provider_message_id),
      last_error = pg_catalog.left(coalesce(p_last_error, 'Provider outcome is unknown'), 1000),
      error = pg_catalog.left(coalesce(p_last_error, 'Provider outcome is unknown'), 1000),
      claim_token = null, claimed_at = null, claim_expires_at = null,
      worker_id = null,
      updated_at = pg_catalog.now()
  from public.message_chain as chain_row
  where delivery_row.id = p_delivery_id
    and delivery_row.chain_id = chain_row.id
    and chain_row.organization_id = p_organization_id
    and delivery_row.status = 'processing'
    and delivery_row.claim_token = p_claim_token
    and delivery_row.claim_expires_at >= pg_catalog.now()
    and delivery_row.send_started_at is not null
  returning delivery_row.* into v_delivery;
  return v_delivery;
end;
$$;

alter table public.message_chain_delivery enable row level security;

-- Browser roles only need historical delivery reads. Capture those effective
-- SELECT grants before revoking every direct write path; all state, identity,
-- scheduling and provider outcome mutations are server-side operations.
do $$
declare v_role text; v_privilege text; v_columns text; v_all_columns text;
begin
  select pg_catalog.string_agg(pg_catalog.quote_ident(attribute_row.attname), ', ' order by attribute_row.attnum)
  into v_all_columns
  from pg_catalog.pg_attribute as attribute_row
  where attribute_row.attrelid = 'public.message_chain_delivery'::regclass
    and attribute_row.attnum > 0
    and not attribute_row.attisdropped;

  foreach v_role in array array['anon', 'authenticated'] loop
    select pg_catalog.string_agg(pg_catalog.quote_ident(attribute_row.attname), ', ' order by attribute_row.attnum)
    into v_columns
    from pg_catalog.pg_attribute as attribute_row
    where attribute_row.attrelid = 'public.message_chain_delivery'::regclass
      and attribute_row.attnum > 0
      and not attribute_row.attisdropped
      and attribute_row.attname not in (
        'claim_token', 'claimed_at', 'claim_expires_at', 'attempt_count',
        'send_started_at', 'last_error', 'claim_protocol_started_at', 'worker_id'
      )
      and pg_catalog.has_column_privilege(
        v_role,
        'public.message_chain_delivery'::regclass,
        attribute_row.attnum,
        'SELECT'
      );

    execute pg_catalog.format(
      'revoke all privileges on table public.message_chain_delivery from %I',
      v_role
    );
    foreach v_privilege in array array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] loop
      execute pg_catalog.format(
        'revoke %s (%s) on table public.message_chain_delivery from %I',
        v_privilege,
        v_all_columns,
        v_role
      );
    end loop;
    if v_columns is not null then
      execute pg_catalog.format(
        'grant select (%s) on table public.message_chain_delivery to %I',
        v_columns,
        v_role
      );
    end if;
  end loop;
end
$$;

revoke all privileges on table public.message_chain_delivery from public;
do $$
declare v_columns text; v_privilege text;
begin
  select pg_catalog.string_agg(pg_catalog.quote_ident(attribute_row.attname), ', ' order by attribute_row.attnum)
  into v_columns
  from pg_catalog.pg_attribute as attribute_row
  where attribute_row.attrelid = 'public.message_chain_delivery'::regclass
    and attribute_row.attnum > 0
    and not attribute_row.attisdropped;
  foreach v_privilege in array array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] loop
    execute pg_catalog.format(
      'revoke %s (%s) on table public.message_chain_delivery from public',
      v_privilege,
      v_columns
    );
  end loop;
end
$$;
revoke select (
  claim_token, claimed_at, claim_expires_at, attempt_count, send_started_at,
  last_error, claim_protocol_started_at, worker_id
) on table public.message_chain_delivery from public, anon, authenticated;

-- These columns determine identity, scheduling, external-send outcome or
-- progression. They are written exclusively by service-side repositories/RPCs.
revoke insert (
  chain_id, chain_step_id, chain_recipient_id, user_id, step_index,
  status, message_id, provider_message_id, sent_at, read_at, failed_at, due_at,
  error, claim_token, claimed_at, claim_expires_at, attempt_count,
  send_started_at, last_error, claim_protocol_started_at, worker_id
) on table public.message_chain_delivery from public, anon, authenticated;
revoke update (
  chain_id, chain_step_id, chain_recipient_id, user_id, step_index,
  status, message_id, provider_message_id, sent_at, read_at, failed_at, due_at,
  error, claim_token, claimed_at, claim_expires_at, attempt_count,
  send_started_at, last_error, claim_protocol_started_at, worker_id
) on table public.message_chain_delivery from public, anon, authenticated;
revoke references (
  chain_id, chain_step_id, chain_recipient_id, user_id, step_index,
  status, message_id, provider_message_id, sent_at, read_at, failed_at, due_at,
  error, claim_token, claimed_at, claim_expires_at, attempt_count,
  send_started_at, last_error, claim_protocol_started_at, worker_id
) on table public.message_chain_delivery from public, anon, authenticated;

revoke all privileges on function public.ensure_message_chain_delivery(integer, uuid, uuid, uuid, integer, integer, text, timestamp with time zone) from public, anon, authenticated;
revoke all privileges on function public.claim_message_chain_delivery(uuid, integer, uuid, uuid, uuid, integer, text, integer) from public, anon, authenticated;
revoke all privileges on function public.renew_message_chain_delivery_lease(uuid, integer, uuid, integer) from public, anon, authenticated;
revoke all privileges on function public.mark_message_chain_delivery_send_started(uuid, integer, uuid) from public, anon, authenticated;
revoke all privileges on function public.complete_message_chain_delivery_send(uuid, integer, uuid, integer, text) from public, anon, authenticated;
revoke all privileges on function public.fail_message_chain_delivery_before_send(uuid, integer, uuid, text) from public, anon, authenticated;
revoke all privileges on function public.fail_message_chain_delivery_after_send(uuid, integer, uuid, text, text) from public, anon, authenticated;
revoke all privileges on function public.mark_message_chain_delivery_unknown_outcome(uuid, integer, uuid, text, text) from public, anon, authenticated;

grant execute on function public.ensure_message_chain_delivery(integer, uuid, uuid, uuid, integer, integer, text, timestamp with time zone) to service_role;
grant execute on function public.claim_message_chain_delivery(uuid, integer, uuid, uuid, uuid, integer, text, integer) to service_role;
grant execute on function public.renew_message_chain_delivery_lease(uuid, integer, uuid, integer) to service_role;
grant execute on function public.mark_message_chain_delivery_send_started(uuid, integer, uuid) to service_role;
grant execute on function public.complete_message_chain_delivery_send(uuid, integer, uuid, integer, text) to service_role;
grant execute on function public.fail_message_chain_delivery_before_send(uuid, integer, uuid, text) to service_role;
grant execute on function public.fail_message_chain_delivery_after_send(uuid, integer, uuid, text, text) to service_role;
grant execute on function public.mark_message_chain_delivery_unknown_outcome(uuid, integer, uuid, text, text) to service_role;

do $$
declare v_function regprocedure; v_column text; v_privilege text;
begin
  foreach v_function in array array[
    'public.ensure_message_chain_delivery(integer,uuid,uuid,uuid,integer,integer,text,timestamp with time zone)'::regprocedure,
    'public.claim_message_chain_delivery(uuid,integer,uuid,uuid,uuid,integer,text,integer)'::regprocedure,
    'public.renew_message_chain_delivery_lease(uuid,integer,uuid,integer)'::regprocedure,
    'public.mark_message_chain_delivery_send_started(uuid,integer,uuid)'::regprocedure,
    'public.complete_message_chain_delivery_send(uuid,integer,uuid,integer,text)'::regprocedure,
    'public.fail_message_chain_delivery_before_send(uuid,integer,uuid,text)'::regprocedure,
    'public.fail_message_chain_delivery_after_send(uuid,integer,uuid,text,text)'::regprocedure,
    'public.mark_message_chain_delivery_unknown_outcome(uuid,integer,uuid,text,text)'::regprocedure
  ] loop
    if pg_catalog.has_function_privilege('anon', v_function, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', v_function, 'EXECUTE')
       or not pg_catalog.has_function_privilege('service_role', v_function, 'EXECUTE') then
      raise exception using errcode = '42501', message = 'message chain delivery RPC privilege validation failed';
    end if;
    if exists (
      select 1
      from pg_catalog.pg_proc as procedure_row
      cross join lateral pg_catalog.aclexplode(
        coalesce(procedure_row.proacl, pg_catalog.acldefault('f', procedure_row.proowner))
      ) as procedure_acl
      where procedure_row.oid = v_function
        and procedure_acl.grantee = 0
        and procedure_acl.privilege_type = 'EXECUTE'
    ) then
      raise exception using errcode = '42501', message = 'PUBLIC retains message chain delivery RPC execute privilege';
    end if;
  end loop;
  if exists (
    select 1
    from pg_catalog.pg_class as class_row
    cross join lateral pg_catalog.aclexplode(
      coalesce(class_row.relacl, pg_catalog.acldefault('r', class_row.relowner))
    ) as table_acl
    where class_row.oid = 'public.message_chain_delivery'::regclass
      and table_acl.grantee = 0
  ) then
    raise exception using errcode = '42501', message = 'PUBLIC retains message chain delivery table privilege';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_attribute as attribute_row
    cross join lateral pg_catalog.aclexplode(attribute_row.attacl) as column_acl
    where attribute_row.attrelid = 'public.message_chain_delivery'::regclass
      and column_acl.grantee = 0
      and column_acl.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
  ) then
    raise exception using errcode = '42501', message = 'PUBLIC retains internal message chain delivery column privilege';
  end if;

  foreach v_column in array array[
    'claim_token', 'claimed_at', 'claim_expires_at', 'attempt_count',
    'send_started_at', 'last_error', 'claim_protocol_started_at', 'worker_id'
  ] loop
    if pg_catalog.has_column_privilege('anon', 'public.message_chain_delivery', v_column, 'SELECT')
       or pg_catalog.has_column_privilege('authenticated', 'public.message_chain_delivery', v_column, 'SELECT') then
      raise exception using errcode = '42501', message = 'message chain delivery internal column select privilege validation failed';
    end if;
  end loop;
  foreach v_column in array array[
    'chain_id', 'chain_step_id', 'chain_recipient_id', 'user_id', 'step_index',
    'status', 'message_id', 'provider_message_id', 'sent_at', 'read_at',
    'failed_at', 'due_at', 'error', 'claim_token', 'claimed_at',
    'claim_expires_at', 'attempt_count', 'send_started_at', 'last_error',
    'claim_protocol_started_at', 'worker_id'
  ] loop
    foreach v_privilege in array array['INSERT', 'UPDATE'] loop
      if pg_catalog.has_column_privilege('anon', 'public.message_chain_delivery', v_column, v_privilege)
         or pg_catalog.has_column_privilege('authenticated', 'public.message_chain_delivery', v_column, v_privilege) then
        raise exception using errcode = '42501', message = 'message chain delivery authoritative column write privilege validation failed';
      end if;
    end loop;
  end loop;
  if not pg_catalog.has_table_privilege('service_role', 'public.message_chain_delivery', 'SELECT,INSERT,UPDATE') then
    raise exception using errcode = '42501', message = 'service_role lacks message chain delivery privileges';
  end if;
end
$$;

commit;
