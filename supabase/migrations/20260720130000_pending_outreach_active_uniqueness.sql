-- Functional pending-outreach correlation.  One active reservation is allowed
-- per organization/user until an inbound correlation key exists.

begin;

-- This must run while the historical CHECK still permits the legacy state, or
-- the descriptive reconciliation error below would be unreachable.
do $$
declare
  v_duplicate record;
  v_event_duplicate record;
begin
  if exists (
    select 1
    from public.pending_outreach
    where status = 'waiting_template_reply'
  ) then
    raise exception using
      errcode = '23514',
      message = 'pending_outreach migration blocked: historical waiting_template_reply rows require manual reconciliation';
  end if;

  select
    pending_row.org_id,
    pending_row.user_id,
    pg_catalog.string_agg(pending_row.id::text, ',' order by pending_row.created_at, pending_row.id)
  into v_duplicate
  from public.pending_outreach as pending_row
  where pending_row.status in (
    'reserving', 'pending', 'processing', 'retryable_failed', 'unknown_outcome'
  )
  group by pending_row.org_id, pending_row.user_id
  having count(*) > 1
  order by pending_row.org_id, pending_row.user_id
  limit 1;

  if found then
    raise exception using
      errcode = '23505',
      message = pg_catalog.format(
        'pending_outreach migration blocked: active duplicates require manual reconciliation (org_id=%s, user_id=%s, pending_outreach_ids=%s)',
        v_duplicate.org_id, v_duplicate.user_id, v_duplicate.string_agg
      );
  end if;

  select
    pending_row.webhook_event_id,
    pg_catalog.string_agg(pending_row.id::text, ',' order by pending_row.created_at, pending_row.id)
  into v_event_duplicate
  from public.pending_outreach as pending_row
  where pending_row.webhook_event_id is not null
  group by pending_row.webhook_event_id
  having count(*) > 1
  order by pending_row.webhook_event_id
  limit 1;

  if found then
    raise exception using
      errcode = '23505',
      message = pg_catalog.format(
        'pending_outreach migration blocked: webhook_event_id duplicates require manual reconciliation (webhook_event_id=%s, pending_outreach_ids=%s)',
        v_event_duplicate.webhook_event_id, v_event_duplicate.string_agg
      );
  end if;
end
$$;

alter table public.pending_outreach
  alter column status set default 'pending';

alter table public.pending_outreach
  add column if not exists worker_id text null,
  add column if not exists template_send_started_at timestamp with time zone null,
  drop constraint if exists pending_outreach_status_check,
  add constraint pending_outreach_status_check check (
    status in (
      'reserving', 'pending', 'processing', 'replied', 'retryable_failed',
      'unknown_outcome', 'failed', 'expired'
    )
  );

drop index if exists public.ux_pending_outreach_user_waiting;

create unique index ux_pending_outreach_active_org_user
  on public.pending_outreach (org_id, user_id)
  where status in ('reserving', 'pending', 'processing', 'retryable_failed', 'unknown_outcome');

create unique index ux_pending_outreach_webhook_event_once
  on public.pending_outreach (webhook_event_id)
  where webhook_event_id is not null;

create or replace function public.assert_pending_outreach_context(
  p_organization_id integer,
  p_user_id integer,
  p_message_chain_id uuid,
  p_message_chain_step_id uuid,
  p_message_chain_recipient_id uuid,
  p_message_chain_step_index integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'pending outreach context is restricted to service_role';
  end if;

  if p_organization_id is null or p_user_id is null or not exists (
    select 1
    from public."user" as user_row
    where user_row.id = p_user_id
      and user_row.organization_id = p_organization_id
  ) then
    raise exception using errcode = '42501', message = 'pending outreach user does not belong to organization';
  end if;

  if p_message_chain_id is null then
    if p_message_chain_step_id is not null
       or p_message_chain_recipient_id is not null
       or p_message_chain_step_index is not null then
      raise exception using errcode = '22023', message = 'pending outreach chain metadata is incomplete';
    end if;
    return;
  end if;

  if p_message_chain_step_id is null
     or p_message_chain_recipient_id is null
     or p_message_chain_step_index is null
     or p_message_chain_step_index < 1 then
    raise exception using errcode = '22023', message = 'pending outreach chain metadata is incomplete';
  end if;

  if not exists (
    select 1
    from public.message_chain as chain_row
    where chain_row.id = p_message_chain_id
      and chain_row.organization_id = p_organization_id
  ) then
    raise exception using errcode = '42501', message = 'pending outreach chain does not belong to organization';
  end if;

  if not exists (
    select 1
    from public.message_chain_step as step_row
    where step_row.id = p_message_chain_step_id
      and step_row.chain_id = p_message_chain_id
      and step_row.step_index = p_message_chain_step_index
  ) then
    raise exception using errcode = '42501', message = 'pending outreach chain step is incompatible';
  end if;

  if not exists (
    select 1
    from public.message_chain_recipient as recipient_row
    where recipient_row.id = p_message_chain_recipient_id
      and recipient_row.chain_id = p_message_chain_id
      and recipient_row.user_id = p_user_id
  ) then
    raise exception using errcode = '42501', message = 'pending outreach chain recipient is incompatible';
  end if;
end;
$$;

create or replace function public.reserve_pending_outreach(
  p_organization_id integer,
  p_user_id integer,
  p_payload jsonb,
  p_expires_at timestamp with time zone,
  p_message_chain_id uuid default null,
  p_message_chain_step_id uuid default null,
  p_message_chain_recipient_id uuid default null,
  p_message_chain_step_index integer default null,
  p_worker_id text default null,
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
    raise exception using errcode = '42501', message = 'reserve_pending_outreach is restricted to service_role';
  end if;
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_expires_at is null or p_expires_at <= pg_catalog.now()
     or nullif(pg_catalog.btrim(p_worker_id), '') is null
     or p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'pending outreach reservation arguments are invalid';
  end if;

  perform public.assert_pending_outreach_context(
    p_organization_id, p_user_id, p_message_chain_id, p_message_chain_step_id,
    p_message_chain_recipient_id, p_message_chain_step_index
  );

  insert into public.pending_outreach (
    org_id, user_id, payload, status, expires_at, message_chain_id,
    message_chain_step_id, message_chain_recipient_id, message_chain_step_index,
    claim_token, claimed_at, claim_expires_at, worker_id
  ) values (
    p_organization_id, p_user_id, p_payload, 'reserving', p_expires_at,
    p_message_chain_id, p_message_chain_step_id, p_message_chain_recipient_id,
    p_message_chain_step_index, gen_random_uuid(), pg_catalog.now(),
    pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
    pg_catalog.btrim(p_worker_id)
  ) on conflict (org_id, user_id) where status in (
    'reserving', 'pending', 'processing', 'retryable_failed', 'unknown_outcome'
  ) do nothing
  returning * into v_pending;

  return v_pending;
end;
$$;

create or replace function public.renew_pending_outreach_template_reservation(
  p_pending_outreach_id bigint,
  p_organization_id integer,
  p_user_id integer,
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
    raise exception using errcode = '42501', message = 'renew_pending_outreach_template_reservation is restricted to service_role';
  end if;
  if p_claim_token is null or p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'pending outreach template reservation lease is invalid';
  end if;

  update public.pending_outreach as pending_row
  set claimed_at = pg_catalog.now(),
      claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds)
  where pending_row.id = p_pending_outreach_id
    and pending_row.org_id = p_organization_id
    and pending_row.user_id = p_user_id
    and pending_row.status = 'reserving'
    and pending_row.claim_token = p_claim_token
    and pending_row.claim_expires_at >= pg_catalog.now()
  returning * into v_pending;
  return v_pending;
end;
$$;

create or replace function public.mark_pending_outreach_template_send_started(
  p_pending_outreach_id bigint,
  p_organization_id integer,
  p_user_id integer,
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
    raise exception using errcode = '42501', message = 'mark_pending_outreach_template_send_started is restricted to service_role';
  end if;
  if p_claim_token is null then
    raise exception using errcode = '22023', message = 'pending outreach template reservation token is required';
  end if;

  update public.pending_outreach as pending_row
  set template_send_started_at = coalesce(pending_row.template_send_started_at, pg_catalog.now())
  where pending_row.id = p_pending_outreach_id
    and pending_row.org_id = p_organization_id
    and pending_row.user_id = p_user_id
    and pending_row.status = 'reserving'
    and pending_row.claim_token = p_claim_token
    and pending_row.claim_expires_at >= pg_catalog.now()
  returning * into v_pending;
  return v_pending;
end;
$$;

create or replace function public.complete_pending_outreach_template_reservation(
  p_pending_outreach_id bigint,
  p_organization_id integer,
  p_user_id integer,
  p_claim_token uuid,
  p_template_message_id text
)
returns public.pending_outreach
language plpgsql
security invoker
set search_path = ''
as $$
declare v_pending public.pending_outreach%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'complete_pending_outreach_template_reservation is restricted to service_role';
  end if;
  if p_claim_token is null or nullif(pg_catalog.btrim(p_template_message_id), '') is null then
    raise exception using errcode = '22023', message = 'pending outreach template message id is required';
  end if;

  update public.pending_outreach as pending_row
  set status = 'pending',
      template_message_id = pg_catalog.btrim(p_template_message_id),
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      worker_id = null,
      last_error = null
  where pending_row.id = p_pending_outreach_id
    and pending_row.org_id = p_organization_id
    and pending_row.user_id = p_user_id
    and pending_row.status = 'reserving'
    and pending_row.webhook_event_id is null
    and pending_row.template_send_started_at is not null
    and pending_row.claim_token = p_claim_token
    and pending_row.claim_expires_at >= pg_catalog.now()
  returning * into v_pending;

  if found then
    return v_pending;
  end if;

  select pending_row.* into v_pending
  from public.pending_outreach as pending_row
  where pending_row.id = p_pending_outreach_id
    and pending_row.org_id = p_organization_id
    and pending_row.user_id = p_user_id
    and pending_row.status = 'pending'
    and pending_row.template_send_started_at is not null
    and pending_row.template_message_id = pg_catalog.btrim(p_template_message_id);

  if found then
    return v_pending;
  end if;

  if exists (
    select 1 from public.pending_outreach as pending_row
    where pending_row.id = p_pending_outreach_id
      and pending_row.org_id = p_organization_id
      and pending_row.user_id = p_user_id
      and pending_row.status = 'pending'
      and pending_row.template_message_id is not null
  ) then
    raise exception using errcode = '23505', message = 'pending outreach template message id cannot be overwritten';
  end if;

  return v_pending;
end;
$$;

create or replace function public.fail_pending_outreach_template_reservation(
  p_pending_outreach_id bigint,
  p_organization_id integer,
  p_user_id integer,
  p_claim_token uuid,
  p_last_error text default null
)
returns public.pending_outreach
language plpgsql
security invoker
set search_path = ''
as $$
declare v_pending public.pending_outreach%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'fail_pending_outreach_template_reservation is restricted to service_role';
  end if;
  if p_claim_token is null then
    raise exception using errcode = '22023', message = 'pending outreach reservation token is required';
  end if;

  update public.pending_outreach as pending_row
  set status = case
        when pending_row.template_send_started_at is null then 'failed'
        else 'unknown_outcome'
      end,
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      worker_id = null,
      last_error = case when p_last_error is null then null else pg_catalog.left(p_last_error, 1000) end
  where pending_row.id = p_pending_outreach_id
    and pending_row.org_id = p_organization_id
    and pending_row.user_id = p_user_id
    and pending_row.status = 'reserving'
    and pending_row.webhook_event_id is null
    and pending_row.claim_token = p_claim_token
    and pending_row.claim_expires_at >= pg_catalog.now()
  returning * into v_pending;
  return v_pending;
end;
$$;

create or replace function public.claim_pending_outreach_for_reply(
  p_organization_id integer,
  p_user_id integer,
  p_webhook_event_id uuid,
  p_event_claim_token uuid,
  p_worker_id text,
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
    raise exception using errcode = '42501', message = 'claim_pending_outreach_for_reply is restricted to service_role';
  end if;
  if nullif(pg_catalog.btrim(p_worker_id), '') is null
     or p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'pending outreach reply claim arguments are invalid';
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

  perform public.assert_pending_outreach_context(
    p_organization_id, p_user_id, null, null, null, null
  );

  select pending_row.* into v_pending
  from public.pending_outreach as pending_row
  where pending_row.org_id = p_organization_id
    and pending_row.user_id = p_user_id
    and pending_row.webhook_event_id = p_webhook_event_id
  order by pending_row.created_at asc, pending_row.id asc
  for update of pending_row;

  if found then
    perform public.assert_pending_outreach_context(
      v_pending.org_id, v_pending.user_id, v_pending.message_chain_id,
      v_pending.message_chain_step_id, v_pending.message_chain_recipient_id,
      v_pending.message_chain_step_index
    );
    if v_pending.status in ('replied', 'failed', 'expired', 'unknown_outcome', 'pending', 'reserving') then
      return null;
    end if;
    if v_pending.status = 'processing' then
      if v_pending.send_started_at is not null then
        if v_pending.claim_expires_at >= pg_catalog.now() then
          return null;
        end if;
        update public.pending_outreach as pending_row
        set status = 'unknown_outcome', claim_token = null, claimed_at = null,
            claim_expires_at = null, worker_id = null,
            last_error = 'Pending outreach send lease expired before its outcome was persisted'
        where pending_row.id = v_pending.id;
        return null;
      end if;
      if v_pending.expires_at <= pg_catalog.now() then
        update public.pending_outreach as pending_row
        set status = 'expired', claim_token = null, claimed_at = null,
            claim_expires_at = null, worker_id = null,
            last_error = 'Pending outreach expired before its reply send started'
        where pending_row.id = v_pending.id;
        return null;
      end if;
      if v_pending.claim_expires_at >= pg_catalog.now() then
        return null;
      end if;
    elsif v_pending.status = 'retryable_failed' then
      if v_pending.send_started_at is not null then
        update public.pending_outreach as pending_row
        set status = 'unknown_outcome', claim_token = null, claimed_at = null,
            claim_expires_at = null, worker_id = null,
            last_error = 'Pending outreach retryable failure retained send evidence and requires manual reconciliation'
        where pending_row.id = v_pending.id;
        return null;
      end if;
      if v_pending.expires_at <= pg_catalog.now() then
        update public.pending_outreach as pending_row
        set status = 'expired', claim_token = null, claimed_at = null,
            claim_expires_at = null, worker_id = null,
            last_error = 'Pending outreach retry window expired before its reply send started'
        where pending_row.id = v_pending.id;
        return null;
      end if;
      if v_pending.next_attempt_at > pg_catalog.now() then
        return null;
      end if;
    else
      return null;
    end if;

    update public.pending_outreach as pending_row
    set status = 'processing', attempt_count = pending_row.attempt_count + 1,
        claim_token = gen_random_uuid(), claimed_at = pg_catalog.now(),
        claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
        worker_id = pg_catalog.btrim(p_worker_id), send_started_at = null, last_error = null
    where pending_row.id = v_pending.id
      and pending_row.webhook_event_id = p_webhook_event_id
      and pending_row.status in ('processing', 'retryable_failed')
      and pending_row.expires_at > pg_catalog.now()
      and pending_row.send_started_at is null
      and (pending_row.status <> 'retryable_failed' or pending_row.next_attempt_at <= pg_catalog.now())
    returning * into v_pending;
    return v_pending;
  end if;

  select pending_row.* into v_pending
  from public.pending_outreach as pending_row
  where pending_row.org_id = p_organization_id
    and pending_row.user_id = p_user_id
    and pending_row.status = 'pending'
    and pending_row.webhook_event_id is null
    and pending_row.template_message_id is not null
    and pending_row.template_send_started_at is not null
    and pending_row.expires_at > pg_catalog.now()
  order by pending_row.created_at asc, pending_row.id asc
  for update of pending_row skip locked
  limit 1;

  if not found then
    return null;
  end if;

  perform public.assert_pending_outreach_context(
    v_pending.org_id, v_pending.user_id, v_pending.message_chain_id,
    v_pending.message_chain_step_id, v_pending.message_chain_recipient_id,
    v_pending.message_chain_step_index
  );

  update public.pending_outreach as pending_row
  set status = 'processing', attempt_count = pending_row.attempt_count + 1,
      claim_token = gen_random_uuid(), claimed_at = pg_catalog.now(),
      claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
      webhook_event_id = p_webhook_event_id, worker_id = pg_catalog.btrim(p_worker_id),
      send_started_at = null, last_error = null
  where pending_row.id = v_pending.id
    and pending_row.status = 'pending'
    and pending_row.webhook_event_id is null
    and pending_row.template_message_id is not null
    and pending_row.template_send_started_at is not null
    and pending_row.expires_at > pg_catalog.now()
  returning * into v_pending;
  return v_pending;
end;
$$;

create or replace function public.maintain_pending_outreach(
  p_limit integer default 25
)
returns table (failed_count bigint, expired_count bigint, unknown_outcome_count bigint)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'maintain_pending_outreach is restricted to service_role';
  end if;
  if p_limit < 1 or p_limit > 100 then
    raise exception using errcode = '22023', message = 'pending outreach maintenance limit is invalid';
  end if;

  return query
  with candidates as (
    select pending_row.id, pending_row.status, pending_row.template_send_started_at
    from public.pending_outreach as pending_row
    where (
         pending_row.status = 'reserving'
         and pending_row.claim_expires_at < pg_catalog.now()
       )
       or (pending_row.status = 'pending' and pending_row.expires_at <= pg_catalog.now())
       or (
         pending_row.status = 'retryable_failed'
         and pending_row.expires_at <= pg_catalog.now()
         and pending_row.send_started_at is null
       )
       or (
         pending_row.status = 'processing'
         and pending_row.expires_at <= pg_catalog.now()
         and pending_row.send_started_at is null
       )
       or (
         pending_row.status = 'processing'
         and pending_row.claim_expires_at < pg_catalog.now()
         and pending_row.send_started_at is not null
       )
    order by pending_row.claim_expires_at asc nulls last, pending_row.expires_at asc,
      pending_row.created_at asc, pending_row.id asc
    for update of pending_row skip locked
    limit p_limit
  ), changed as (
    update public.pending_outreach as pending_row
    set status = case
          when pending_row.status = 'reserving'
            and pending_row.template_send_started_at is null then 'failed'
          when pending_row.status = 'reserving' then 'unknown_outcome'
          when pending_row.status in ('pending', 'retryable_failed') then 'expired'
          when pending_row.status = 'processing'
            and pending_row.send_started_at is null then 'expired'
          else 'unknown_outcome'
        end,
        claim_token = null,
        claimed_at = null,
        claim_expires_at = null,
        worker_id = null,
        last_error = case
          when pending_row.status = 'reserving'
            and pending_row.template_send_started_at is null
            then 'Pending outreach template reservation lease expired before the provider request started'
          when pending_row.status = 'reserving'
            then 'Pending outreach template reservation lease expired after the provider request started'
          when pending_row.status = 'processing'
            and pending_row.send_started_at is null
            then 'Pending outreach expired before its reply send started'
          when pending_row.status = 'processing'
            then 'Pending outreach send lease expired before its outcome was persisted'
          else pending_row.last_error
        end
    from candidates
    where pending_row.id = candidates.id
    returning pending_row.status
  )
  select
    count(*) filter (where changed.status = 'failed'),
    count(*) filter (where changed.status = 'expired'),
    count(*) filter (where changed.status = 'unknown_outcome')
  from changed;
end;
$$;

-- The historic transition RPC predates worker ownership.  Replace it so every
-- reply ownership is cleared when the reply reaches a terminal/retry state.
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
  v_effective_status text;
  v_reply_message_id text;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'transition_pending_outreach_for_webhook is restricted to service_role';
  end if;
  if p_status not in ('replied', 'retryable_failed', 'unknown_outcome', 'failed') then
    raise exception using errcode = '22023', message = 'transition_pending_outreach_for_webhook target status is invalid';
  end if;
  if p_status = 'replied' then
    v_reply_message_id = nullif(pg_catalog.btrim(p_reply_message_id), '');
    if v_reply_message_id is null then
      raise exception using errcode = '22023', message = 'pending outreach reply message id is required';
    end if;
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

  select pending_row.* into v_pending
  from public.pending_outreach as pending_row
  where pending_row.id = p_pending_outreach_id
    and pending_row.org_id = p_organization_id
    and pending_row.user_id = p_user_id
    and pending_row.webhook_event_id = p_webhook_event_id
    and pending_row.status = 'processing'
    and pending_row.claim_token = p_claim_token
    and pending_row.claim_expires_at >= pg_catalog.now()
  for update of pending_row;

  if not found then
    select pending_row.* into v_pending
    from public.pending_outreach as pending_row
    where pending_row.id = p_pending_outreach_id
      and pending_row.org_id = p_organization_id
      and pending_row.user_id = p_user_id
      and pending_row.webhook_event_id = p_webhook_event_id
      and pending_row.status = 'replied';

    if found and p_status = 'replied' then
      if v_pending.reply_message_id = v_reply_message_id then
        return v_pending;
      end if;
      raise exception using errcode = '23505', message = 'pending outreach reply message id cannot be overwritten';
    end if;
    return null;
  end if;

  if v_pending.send_started_at is null then
    if p_status = 'replied' then
      raise exception using errcode = '22023', message = 'pending outreach cannot be replied before its send starts';
    end if;
    if p_status not in ('retryable_failed', 'failed') then
      raise exception using errcode = '22023', message = 'pending outreach unknown outcome requires a started send';
    end if;
    v_effective_status = p_status;
  elsif p_status = 'replied' then
    v_effective_status = 'replied';
  else
    -- An external request was started.  Its negative/unknown result is never
    -- retryable automatically and cannot release the active uniqueness key.
    v_effective_status = 'unknown_outcome';
  end if;

  update public.pending_outreach as pending_row
  set status = v_effective_status,
      reply_message_id = case
        when v_effective_status = 'replied' then v_reply_message_id
        else pending_row.reply_message_id
      end,
      next_attempt_at = coalesce(p_next_attempt_at, pending_row.next_attempt_at),
      last_error = case when p_last_error is null then null else pg_catalog.left(p_last_error, 1000) end,
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      worker_id = null,
      send_started_at = case
        when v_effective_status in ('replied', 'unknown_outcome')
          then pending_row.send_started_at
        else null
      end
  where pending_row.id = v_pending.id
    and pending_row.status = 'processing'
    and pending_row.claim_token = p_claim_token
    and pending_row.claim_expires_at >= pg_catalog.now()
  returning * into v_pending;
  return v_pending;
end;
$$;

alter table public.pending_outreach enable row level security;
grant select, insert, update, delete on table public.pending_outreach to service_role;

do $$
declare
  v_role text;
  v_columns text;
  v_privilege text;
begin
  select pg_catalog.string_agg(pg_catalog.quote_ident(attribute_row.attname), ', ' order by attribute_row.attnum)
  into v_columns
  from pg_catalog.pg_attribute as attribute_row
  where attribute_row.attrelid = 'public.pending_outreach'::regclass
    and attribute_row.attnum > 0 and not attribute_row.attisdropped;

  foreach v_privilege in array array['INSERT', 'UPDATE', 'REFERENCES'] loop
    execute pg_catalog.format(
      'revoke %s (%s) on table public.pending_outreach from public',
      v_privilege, v_columns
    );
  end loop;
  revoke insert, update, delete, truncate, references, trigger
    on table public.pending_outreach from public;

  foreach v_role in array array['anon', 'authenticated'] loop
    foreach v_privilege in array array['INSERT', 'UPDATE', 'REFERENCES'] loop
      execute pg_catalog.format(
        'revoke %s (%s) on table public.pending_outreach from %I',
        v_privilege, v_columns, v_role
      );
    end loop;
    execute pg_catalog.format(
      'revoke insert, update, delete, truncate, references, trigger on table public.pending_outreach from %I',
      v_role
    );
  end loop;
end
$$;

revoke all privileges on function public.assert_pending_outreach_context(integer, integer, uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all privileges on function public.reserve_pending_outreach(integer, integer, jsonb, timestamp with time zone, uuid, uuid, uuid, integer, text, integer) from public, anon, authenticated;
revoke all privileges on function public.renew_pending_outreach_template_reservation(bigint, integer, integer, uuid, integer) from public, anon, authenticated;
revoke all privileges on function public.mark_pending_outreach_template_send_started(bigint, integer, integer, uuid) from public, anon, authenticated;
revoke all privileges on function public.complete_pending_outreach_template_reservation(bigint, integer, integer, uuid, text) from public, anon, authenticated;
revoke all privileges on function public.fail_pending_outreach_template_reservation(bigint, integer, integer, uuid, text) from public, anon, authenticated;
revoke all privileges on function public.claim_pending_outreach_for_reply(integer, integer, uuid, uuid, text, integer) from public, anon, authenticated;
revoke all privileges on function public.maintain_pending_outreach(integer) from public, anon, authenticated;
revoke all privileges on function public.transition_pending_outreach_for_webhook(bigint, integer, integer, uuid, uuid, uuid, text, text, text, timestamp with time zone) from public, anon, authenticated;

grant execute on function public.assert_pending_outreach_context(integer, integer, uuid, uuid, uuid, integer) to service_role;
grant execute on function public.reserve_pending_outreach(integer, integer, jsonb, timestamp with time zone, uuid, uuid, uuid, integer, text, integer) to service_role;
grant execute on function public.renew_pending_outreach_template_reservation(bigint, integer, integer, uuid, integer) to service_role;
grant execute on function public.mark_pending_outreach_template_send_started(bigint, integer, integer, uuid) to service_role;
grant execute on function public.complete_pending_outreach_template_reservation(bigint, integer, integer, uuid, text) to service_role;
grant execute on function public.fail_pending_outreach_template_reservation(bigint, integer, integer, uuid, text) to service_role;
grant execute on function public.claim_pending_outreach_for_reply(integer, integer, uuid, uuid, text, integer) to service_role;
grant execute on function public.maintain_pending_outreach(integer) to service_role;
grant execute on function public.transition_pending_outreach_for_webhook(bigint, integer, integer, uuid, uuid, uuid, text, text, text, timestamp with time zone) to service_role;

do $$
declare
  v_function regprocedure;
  v_column text;
  v_role text;
  v_privilege text;
begin
  foreach v_function in array array[
    'public.assert_pending_outreach_context(integer,integer,uuid,uuid,uuid,integer)'::regprocedure,
    'public.reserve_pending_outreach(integer,integer,jsonb,timestamp with time zone,uuid,uuid,uuid,integer,text,integer)'::regprocedure,
    'public.renew_pending_outreach_template_reservation(bigint,integer,integer,uuid,integer)'::regprocedure,
    'public.mark_pending_outreach_template_send_started(bigint,integer,integer,uuid)'::regprocedure,
    'public.complete_pending_outreach_template_reservation(bigint,integer,integer,uuid,text)'::regprocedure,
    'public.fail_pending_outreach_template_reservation(bigint,integer,integer,uuid,text)'::regprocedure,
    'public.claim_pending_outreach_for_reply(integer,integer,uuid,uuid,text,integer)'::regprocedure,
    'public.maintain_pending_outreach(integer)'::regprocedure,
    'public.transition_pending_outreach_for_webhook(bigint,integer,integer,uuid,uuid,uuid,text,text,text,timestamp with time zone)'::regprocedure
  ] loop
    if exists (
         select 1
         from pg_catalog.pg_proc as procedure_row
         cross join lateral pg_catalog.aclexplode(
           coalesce(procedure_row.proacl, pg_catalog.acldefault('f', procedure_row.proowner))
         ) as function_acl
         where procedure_row.oid = v_function
           and function_acl.grantee = 0
           and function_acl.privilege_type = 'EXECUTE'
       )
       or pg_catalog.has_function_privilege('anon', v_function, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', v_function, 'EXECUTE')
       or not pg_catalog.has_function_privilege('service_role', v_function, 'EXECUTE') then
      raise exception using errcode = '42501', message = 'pending outreach RPC privilege validation failed';
    end if;
  end loop;

  if exists (
       select 1
       from pg_catalog.pg_class as table_row
       cross join lateral pg_catalog.aclexplode(
         coalesce(table_row.relacl, pg_catalog.acldefault('r', table_row.relowner))
       ) as table_acl
       where table_row.oid = 'public.pending_outreach'::regclass
         and table_acl.grantee = 0
         and table_acl.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
     ) then
    raise exception using errcode = '42501', message = 'PUBLIC has pending outreach write privileges';
  end if;

  foreach v_role in array array['anon', 'authenticated'] loop
    foreach v_privilege in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
      if pg_catalog.has_table_privilege(v_role, 'public.pending_outreach', v_privilege) then
        raise exception using errcode = '42501', message = 'browser role has pending outreach write privileges';
      end if;
    end loop;
  end loop;

  foreach v_column in array array[
    'id', 'org_id', 'user_id', 'payload', 'status', 'created_at', 'expires_at',
    'template_message_id', 'reply_message_id', 'message_chain_id',
    'message_chain_step_id', 'message_chain_recipient_id', 'message_chain_step_index',
    'attempt_count', 'claimed_at', 'claim_expires_at', 'next_attempt_at',
    'claim_token', 'webhook_event_id', 'send_started_at', 'template_send_started_at',
    'worker_id', 'last_error'
  ] loop
    if pg_catalog.has_column_privilege('anon', 'public.pending_outreach', v_column, 'INSERT')
       or pg_catalog.has_column_privilege('anon', 'public.pending_outreach', v_column, 'UPDATE')
       or pg_catalog.has_column_privilege('authenticated', 'public.pending_outreach', v_column, 'INSERT')
       or pg_catalog.has_column_privilege('authenticated', 'public.pending_outreach', v_column, 'UPDATE')
       or exists (
         select 1
         from pg_catalog.pg_attribute as attribute_row
         cross join lateral pg_catalog.aclexplode(attribute_row.attacl) as column_acl
         where attribute_row.attrelid = 'public.pending_outreach'::regclass
           and attribute_row.attname = v_column
           and column_acl.grantee = 0
           and column_acl.privilege_type in ('INSERT', 'UPDATE')
       ) then
      raise exception using errcode = '42501', message = 'pending outreach authoritative write privilege validation failed';
    end if;
  end loop;

  if not pg_catalog.has_table_privilege(
    'service_role', 'public.pending_outreach', 'SELECT,INSERT,UPDATE,DELETE'
  ) then
    raise exception using errcode = '42501', message = 'service_role lacks pending outreach privileges';
  end if;
end
$$;

commit;
