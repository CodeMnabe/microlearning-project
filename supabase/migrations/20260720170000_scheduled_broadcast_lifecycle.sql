-- Durable scheduled-broadcast lifecycle: claims, attempt ledger and terminal outcomes.
-- Historical processing rows remain unmanaged unless they carry a protocol claim token.

begin;

alter table public.scheduled_broadcast
  add column if not exists claim_token uuid null,
  add column if not exists worker_id text null,
  add column if not exists claimed_at timestamp with time zone null,
  add column if not exists claim_expires_at timestamp with time zone null,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists send_started_at timestamp with time zone null,
  add column if not exists provider_result jsonb null,
  add column if not exists next_attempt_at timestamp with time zone null,
  add column if not exists cancelled_at timestamp with time zone null,
  add column if not exists cancelled_by_user_id uuid null;

do $$
begin
  if pg_catalog.to_regclass('auth.users') is not null
     and not exists (
       select 1
       from pg_catalog.pg_constraint
       where conname = 'scheduled_broadcast_cancelled_by_user_id_fkey'
         and conrelid = 'public.scheduled_broadcast'::pg_catalog.regclass
     ) then
    alter table public.scheduled_broadcast
      add constraint scheduled_broadcast_cancelled_by_user_id_fkey
      foreign key (cancelled_by_user_id)
      references auth.users(id)
      on delete set null;
  end if;
end;
$$;

alter table public.scheduled_broadcast
  drop constraint if exists scheduled_broadcast_status_check;

alter table public.scheduled_broadcast
  add constraint scheduled_broadcast_status_check
  check (status in (
    'queued', 'processing', 'sent', 'partial', 'retryable_failed',
    'unknown_outcome', 'failed', 'cancelled'
  ));

alter table public.automation_run
  drop constraint if exists automation_run_status_check;

alter table public.automation_run
  add constraint automation_run_status_check
  check (status in (
    'queued', 'materialized', 'processing', 'sent', 'partial',
    'unknown_outcome', 'failed', 'cancelled', 'skipped'
  ));

alter table public.scheduled_broadcast
  add constraint scheduled_broadcast_attempt_count_nonnegative
  check (attempt_count >= 0);

create index if not exists scheduled_broadcast_claim_lease_idx
  on public.scheduled_broadcast (claim_expires_at, scheduled_for, created_at, id)
  where status = 'processing' and claim_token is not null;

create index if not exists scheduled_broadcast_retry_due_idx
  on public.scheduled_broadcast (next_attempt_at, scheduled_for, created_at, id)
  where status = 'retryable_failed';

create table if not exists public.scheduled_broadcast_attempt (
  id uuid primary key default gen_random_uuid(),
  organization_id integer not null references public.organization(id) on delete cascade,
  scheduled_broadcast_id uuid not null references public.scheduled_broadcast(id) on delete restrict,
  attempt_number integer not null,
  worker_id text not null,
  claim_token uuid not null,
  status text not null default 'processing'
    check (status in ('processing', 'sent', 'partial', 'retryable_failed', 'unknown_outcome', 'failed', 'cancelled')),
  started_at timestamp with time zone not null default now(),
  send_started_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  provider_result jsonb null,
  last_error text null,
  created_at timestamp with time zone not null default now(),
  unique (scheduled_broadcast_id, attempt_number)
);

create unique index if not exists scheduled_broadcast_attempt_one_active_idx
  on public.scheduled_broadcast_attempt (scheduled_broadcast_id)
  where status = 'processing';

create index if not exists scheduled_broadcast_attempt_claim_idx
  on public.scheduled_broadcast_attempt (scheduled_broadcast_id, claim_token);

alter table public.scheduled_broadcast enable row level security;
alter table public.scheduled_broadcast_attempt enable row level security;

create or replace function public.maintain_scheduled_broadcast_lifecycle(
  p_limit integer default 100,
  p_max_attempts integer default 3
)
returns table (
  retryable_failed_count bigint,
  failed_count bigint,
  unknown_outcome_count bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.scheduled_broadcast%rowtype;
  v_next_status text;
  v_retryable bigint := 0;
  v_failed bigint := 0;
  v_unknown bigint := 0;
  v_broadcast_updated integer;
  v_attempt_updated integer;
  v_run_updated integer;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'maintain_scheduled_broadcast_lifecycle is restricted to service_role';
  end if;
  if p_limit < 1 or p_limit > 1000 or p_max_attempts < 1 or p_max_attempts > 20 then
    raise exception using errcode = '22023', message = 'scheduled broadcast maintenance arguments are invalid';
  end if;

  for v_row in
    select sb.*
    from public.scheduled_broadcast sb
    where sb.status = 'processing'
      and sb.claim_token is not null
      and sb.claim_expires_at <= pg_catalog.now()
    order by sb.claim_expires_at, sb.scheduled_for, sb.created_at, sb.id
    for update of sb skip locked
    limit p_limit
  loop
    if v_row.send_started_at is not null then
      v_next_status := 'unknown_outcome';
      v_unknown := v_unknown + 1;
    elsif v_row.attempt_count >= p_max_attempts then
      v_next_status := 'failed';
      v_failed := v_failed + 1;
    else
      v_next_status := 'retryable_failed';
      v_retryable := v_retryable + 1;
    end if;

    update public.scheduled_broadcast as sb
    set status = v_next_status,
        claim_token = null,
        worker_id = null,
        claimed_at = null,
        claim_expires_at = null,
        next_attempt_at = case when v_next_status = 'retryable_failed'
          then pg_catalog.now() + pg_catalog.make_interval(secs => least(3600, 30 * power(2, greatest(v_row.attempt_count - 1, 0))::integer))
          else null end,
        completed_at = case when v_next_status in ('failed', 'unknown_outcome') then pg_catalog.now() else sb.completed_at end,
        last_error = case
          when v_next_status = 'unknown_outcome' then 'Scheduled broadcast lease expired after provider request started'
          when v_next_status = 'failed' then 'Scheduled broadcast lease expired before provider request after max attempts'
          else 'Scheduled broadcast lease expired before provider request started'
        end,
        updated_at = pg_catalog.now()
    where sb.id = v_row.id and sb.claim_token = v_row.claim_token;
    get diagnostics v_broadcast_updated = row_count;
    if v_broadcast_updated <> 1 then
      raise exception using errcode = 'P0001', message = 'scheduled broadcast maintenance lost broadcast ownership';
    end if;

    update public.scheduled_broadcast_attempt as attempt
    set status = v_next_status,
        completed_at = pg_catalog.now(),
        last_error = case
          when v_next_status = 'unknown_outcome' then 'Lease expired after provider request started'
          when v_next_status = 'failed' then 'Lease expired before provider request after max attempts'
          else 'Lease expired before provider request started'
        end
    where attempt.organization_id = v_row.organization_id
      and attempt.scheduled_broadcast_id = v_row.id
      and attempt.attempt_number = v_row.attempt_count
      and attempt.claim_token = v_row.claim_token
      and attempt.status = 'processing';
    get diagnostics v_attempt_updated = row_count;
    if v_attempt_updated <> 1 then
      raise exception using errcode = 'P0001', message = 'scheduled broadcast maintenance requires exactly one active attempt';
    end if;

    if v_row.automation_run_id is not null then
      update public.automation_run as run
      set status = case v_next_status
          when 'retryable_failed' then 'materialized'
          when 'unknown_outcome' then 'unknown_outcome'
          else 'failed'
        end,
        last_error = case
          when v_next_status = 'unknown_outcome' then 'Scheduled broadcast outcome is unknown after lease expiry'
          else 'Scheduled broadcast lease expired before provider request'
        end,
        processed_at = case when v_next_status in ('failed', 'unknown_outcome') then pg_catalog.now() else run.processed_at end,
        updated_at = pg_catalog.now()
      where run.id = v_row.automation_run_id
        and run.organization_id = v_row.organization_id
        and run.scheduled_broadcast_id = v_row.id
        and run.status = 'processing';
      get diagnostics v_run_updated = row_count;
      if v_run_updated <> 1 then
        raise exception using errcode = 'P0001', message = 'scheduled broadcast maintenance requires its automation run to be processing';
      end if;
    end if;
  end loop;

  return query select v_retryable, v_failed, v_unknown;
end;
$$;

create or replace function public.claim_due_scheduled_broadcasts(
  p_worker_id text,
  p_limit integer default 100,
  p_lease_seconds integer default 120,
  p_max_attempts integer default 3
)
returns setof public.scheduled_broadcast
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.scheduled_broadcast%rowtype;
  v_claim_token uuid;
  v_claimed public.scheduled_broadcast%rowtype;
  v_run_updated integer;
  v_broadcast_updated integer;
  v_attempt_created integer;
  v_active_attempt_count integer;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'claim_due_scheduled_broadcasts is restricted to service_role';
  end if;
  if nullif(pg_catalog.btrim(p_worker_id), '') is null
     or p_limit < 1 or p_limit > 1000
     or p_lease_seconds < 15 or p_lease_seconds > 900
     or p_max_attempts < 1 or p_max_attempts > 20 then
    raise exception using errcode = '22023', message = 'scheduled broadcast claim arguments are invalid';
  end if;

  for v_row in
    select sb.*
    from public.scheduled_broadcast sb
    join public.organization org on org.id = sb.organization_id
    where sb.scheduled_for <= pg_catalog.now()
      and (
        sb.status = 'queued'
        or (sb.status = 'retryable_failed' and sb.next_attempt_at <= pg_catalog.now() and sb.send_started_at is null)
      )
      and sb.attempt_count < p_max_attempts
      and sb.claim_token is null
    order by sb.scheduled_for, sb.created_at, sb.id
    for update of sb skip locked
    limit p_limit
  loop
    if v_row.automation_run_id is not null then
      update public.automation_run as run
      set status = 'processing', updated_at = pg_catalog.now()
      where run.id = v_row.automation_run_id
        and run.organization_id = v_row.organization_id
        and run.scheduled_broadcast_id = v_row.id
        and run.status = 'materialized';
      get diagnostics v_run_updated = row_count;
      if v_run_updated <> 1 then
        raise exception using errcode = 'P0001', message = 'scheduled broadcast claim requires its automation run to be materialized';
      end if;
    end if;

    v_claim_token := gen_random_uuid();
    update public.scheduled_broadcast as sb
    set status = 'processing',
        claim_token = v_claim_token,
        worker_id = pg_catalog.btrim(p_worker_id),
        claimed_at = pg_catalog.now(),
        claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
        attempt_count = sb.attempt_count + 1,
        started_at = coalesce(sb.started_at, pg_catalog.now()),
        next_attempt_at = null,
        last_error = null,
        updated_at = pg_catalog.now()
    where sb.id = v_row.id
      and sb.organization_id = v_row.organization_id
       and sb.claim_token is null
    returning * into v_claimed;
    get diagnostics v_broadcast_updated = row_count;
    if v_broadcast_updated <> 1 or v_claimed.id is null then
      raise exception using errcode = 'P0001', message = 'scheduled broadcast claim lost ownership';
    end if;

    insert into public.scheduled_broadcast_attempt (
      organization_id, scheduled_broadcast_id, attempt_number, worker_id, claim_token, status, started_at
    ) values (
      v_claimed.organization_id, v_claimed.id, v_claimed.attempt_count,
      v_claimed.worker_id, v_claimed.claim_token, 'processing', pg_catalog.now()
    );
    get diagnostics v_attempt_created = row_count;
    if v_attempt_created <> 1 then
      raise exception using errcode = 'P0001', message = 'scheduled broadcast claim requires exactly one attempt';
    end if;
    select count(*) into v_active_attempt_count
    from public.scheduled_broadcast_attempt as attempt
    where attempt.organization_id = v_claimed.organization_id
      and attempt.scheduled_broadcast_id = v_claimed.id
      and attempt.attempt_number = v_claimed.attempt_count
      and attempt.claim_token = v_claimed.claim_token
      and attempt.status = 'processing';
    if v_active_attempt_count <> 1 then
      raise exception using errcode = 'P0001', message = 'scheduled broadcast claim requires exactly one matching active attempt';
    end if;
    return next v_claimed;
  end loop;
end;
$$;

create or replace function public.renew_scheduled_broadcast_lease(
  p_scheduled_broadcast_id uuid,
  p_organization_id integer,
  p_claim_token uuid,
  p_worker_id text,
  p_lease_seconds integer default 120
)
returns public.scheduled_broadcast
language plpgsql
security invoker
set search_path = ''
as $$
declare v_row public.scheduled_broadcast%rowtype;
begin
  if current_user <> 'service_role' then raise exception using errcode = '42501', message = 'renew_scheduled_broadcast_lease is restricted to service_role'; end if;
  if p_claim_token is null or nullif(pg_catalog.btrim(p_worker_id), '') is null or p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'scheduled broadcast lease arguments are invalid';
  end if;
  update public.scheduled_broadcast as sb
  set claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds), updated_at = pg_catalog.now()
  where sb.id = p_scheduled_broadcast_id and sb.organization_id = p_organization_id
    and sb.status = 'processing' and sb.claim_token = p_claim_token
    and sb.worker_id = pg_catalog.btrim(p_worker_id) and sb.claim_expires_at > pg_catalog.now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.mark_scheduled_broadcast_send_started(
  p_scheduled_broadcast_id uuid,
  p_organization_id integer,
  p_claim_token uuid,
  p_worker_id text
)
returns public.scheduled_broadcast
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.scheduled_broadcast%rowtype;
  v_broadcast_updated integer;
  v_attempt_updated integer;
begin
  if current_user <> 'service_role' then raise exception using errcode = '42501', message = 'mark_scheduled_broadcast_send_started is restricted to service_role'; end if;
  update public.scheduled_broadcast as sb
  set send_started_at = coalesce(sb.send_started_at, pg_catalog.now()), updated_at = pg_catalog.now()
  where sb.id = p_scheduled_broadcast_id and sb.organization_id = p_organization_id
    and sb.status = 'processing' and sb.claim_token = p_claim_token
    and sb.worker_id = pg_catalog.btrim(p_worker_id) and sb.claim_expires_at > pg_catalog.now()
  returning * into v_row;
  get diagnostics v_broadcast_updated = row_count;
  if v_broadcast_updated = 0 then
    return null;
  end if;
  if v_broadcast_updated <> 1 or v_row.id is null then
    raise exception using errcode = 'P0001', message = 'scheduled broadcast send start updated an unexpected number of broadcasts';
  end if;
  update public.scheduled_broadcast_attempt as attempt
  set send_started_at = coalesce(attempt.send_started_at, pg_catalog.now())
  where attempt.organization_id = v_row.organization_id
    and attempt.scheduled_broadcast_id = v_row.id
    and attempt.attempt_number = v_row.attempt_count
    and attempt.claim_token = p_claim_token
    and attempt.status = 'processing';
  get diagnostics v_attempt_updated = row_count;
  if v_attempt_updated <> 1 then
    raise exception using errcode = 'P0001', message = 'scheduled broadcast send start requires exactly one active attempt';
  end if;
  return v_row;
end;
$$;

create or replace function public.complete_scheduled_broadcast(
  p_scheduled_broadcast_id uuid,
  p_organization_id integer,
  p_claim_token uuid,
  p_worker_id text,
  p_outcome text,
  p_provider_result jsonb default null,
  p_last_error text default null,
  p_max_attempts integer default 3
)
returns public.scheduled_broadcast
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current public.scheduled_broadcast%rowtype;
  v_row public.scheduled_broadcast%rowtype;
  v_effective_status text;
  v_broadcast_updated integer;
  v_attempt_updated integer;
  v_run_updated integer;
begin
  if current_user <> 'service_role' then raise exception using errcode = '42501', message = 'complete_scheduled_broadcast is restricted to service_role'; end if;
  if p_outcome not in ('sent', 'partial', 'retryable_failed', 'failed', 'unknown_outcome')
     or p_max_attempts < 1 or p_max_attempts > 20 then
    raise exception using errcode = '22023', message = 'scheduled broadcast outcome is invalid';
  end if;
  select sb.* into v_current from public.scheduled_broadcast sb
  where sb.id = p_scheduled_broadcast_id and sb.organization_id = p_organization_id
  for update of sb;
  if not found then return null; end if;
  if v_current.status in ('sent', 'partial', 'failed', 'unknown_outcome', 'cancelled') then
    return null;
  end if;
  if v_current.status <> 'processing' or v_current.claim_token <> p_claim_token
     or v_current.worker_id <> pg_catalog.btrim(p_worker_id) or v_current.claim_expires_at <= pg_catalog.now() then
    return null;
  end if;
  v_effective_status := p_outcome;
  if v_current.send_started_at is not null and p_outcome not in ('sent', 'partial') then
    v_effective_status := 'unknown_outcome';
  elsif v_current.send_started_at is null and p_outcome in ('sent', 'partial', 'unknown_outcome') then
    v_effective_status := 'failed';
  elsif v_current.send_started_at is null and p_outcome = 'retryable_failed'
     and v_current.attempt_count >= p_max_attempts then
    v_effective_status := 'failed';
  end if;

  update public.scheduled_broadcast as sb
  set status = v_effective_status,
      provider_result = coalesce(p_provider_result, sb.provider_result),
      last_error = p_last_error,
      claim_token = null, worker_id = null, claimed_at = null, claim_expires_at = null,
      next_attempt_at = case when v_effective_status = 'retryable_failed'
        then pg_catalog.now() + pg_catalog.make_interval(secs => least(3600, 30 * power(2, greatest(sb.attempt_count - 1, 0))::integer))
        else null end,
      completed_at = case when v_effective_status in ('sent', 'partial', 'failed', 'unknown_outcome') then pg_catalog.now() else null end,
      updated_at = pg_catalog.now()
  where sb.id = v_current.id and sb.claim_token = p_claim_token
  returning * into v_row;
  get diagnostics v_broadcast_updated = row_count;
  if v_broadcast_updated <> 1 or v_row.id is null then
    raise exception using errcode = 'P0001', message = 'scheduled broadcast completion lost ownership';
  end if;

  update public.scheduled_broadcast_attempt as attempt
  set status = v_effective_status, completed_at = pg_catalog.now(),
      provider_result = coalesce(p_provider_result, attempt.provider_result), last_error = p_last_error
  where attempt.organization_id = v_row.organization_id
    and attempt.scheduled_broadcast_id = v_row.id
    and attempt.attempt_number = v_current.attempt_count
    and attempt.claim_token = p_claim_token
    and attempt.status = 'processing';
  get diagnostics v_attempt_updated = row_count;
  if v_attempt_updated <> 1 then
    raise exception using errcode = 'P0001', message = 'scheduled broadcast completion requires exactly one active attempt';
  end if;

  if v_row.automation_run_id is not null then
    update public.automation_run as run
    set status = case v_effective_status
          when 'sent' then 'sent' when 'partial' then 'partial'
          when 'retryable_failed' then 'materialized'
          when 'unknown_outcome' then 'unknown_outcome' else 'failed' end,
        last_error = p_last_error,
        processed_at = case when v_effective_status in ('sent', 'partial', 'failed', 'unknown_outcome') then pg_catalog.now() else run.processed_at end,
        updated_at = pg_catalog.now()
    where run.id = v_row.automation_run_id and run.organization_id = v_row.organization_id
      and run.scheduled_broadcast_id = v_row.id and run.status = 'processing';
    get diagnostics v_run_updated = row_count;
    if v_run_updated <> 1 then
      raise exception using errcode = 'P0001', message = 'scheduled broadcast completion requires its automation run to be processing';
    end if;
  end if;
  return v_row;
end;
$$;

create or replace function public.edit_scheduled_broadcast(
  p_scheduled_broadcast_id uuid,
  p_organization_id integer,
  p_actor_user_id uuid,
  p_scheduled_for timestamp with time zone,
  p_timezone text,
  p_expected_updated_at timestamp with time zone
)
returns public.scheduled_broadcast
language plpgsql
security invoker
set search_path = ''
as $$
declare v_row public.scheduled_broadcast%rowtype;
begin
  if current_user <> 'service_role' then raise exception using errcode = '42501', message = 'edit_scheduled_broadcast is restricted to service_role'; end if;
  update public.scheduled_broadcast as sb
  set scheduled_for = coalesce(p_scheduled_for, sb.scheduled_for), timezone = coalesce(p_timezone, sb.timezone), updated_at = pg_catalog.now()
  where sb.id = p_scheduled_broadcast_id and sb.organization_id = p_organization_id
    and exists (
      select 1 from public.organization as org
      where org.id = sb.organization_id and org.owner_user_id = p_actor_user_id
    )
    and sb.status = 'queued' and sb.claim_token is null and sb.send_started_at is null
    and sb.updated_at = p_expected_updated_at
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.cancel_scheduled_broadcast(
  p_scheduled_broadcast_id uuid,
  p_organization_id integer,
  p_cancelled_by_user_id uuid default null,
  p_reason text default null
)
returns public.scheduled_broadcast
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.scheduled_broadcast%rowtype;
  v_broadcast_updated integer;
  v_run_updated integer;
begin
  if current_user <> 'service_role' then raise exception using errcode = '42501', message = 'cancel_scheduled_broadcast is restricted to service_role'; end if;
  update public.scheduled_broadcast as sb
  set status = 'cancelled', cancelled_at = pg_catalog.now(), cancelled_by_user_id = p_cancelled_by_user_id,
      last_error = coalesce(p_reason, sb.last_error), updated_at = pg_catalog.now()
  where sb.id = p_scheduled_broadcast_id and sb.organization_id = p_organization_id
    and exists (
      select 1 from public.organization as org
      where org.id = sb.organization_id and org.owner_user_id = p_cancelled_by_user_id
    )
    and sb.status in ('queued', 'retryable_failed') and sb.claim_token is null and sb.send_started_at is null
    and not exists (
      select 1
      from public.scheduled_broadcast_attempt as attempt
      where attempt.organization_id = sb.organization_id
        and attempt.scheduled_broadcast_id = sb.id
        and attempt.status = 'processing'
    )
  returning * into v_row;
  get diagnostics v_broadcast_updated = row_count;
  if v_broadcast_updated = 0 then
    return null;
  end if;
  if v_broadcast_updated <> 1 or v_row.id is null then
    raise exception using errcode = 'P0001', message = 'scheduled broadcast cancellation updated an unexpected number of broadcasts';
  end if;
  if v_row.automation_run_id is not null then
    update public.automation_run as run
    set status = 'cancelled', last_error = coalesce(p_reason, 'Scheduled broadcast cancelled'), processed_at = pg_catalog.now(), updated_at = pg_catalog.now()
    where run.id = v_row.automation_run_id and run.organization_id = v_row.organization_id
      and run.scheduled_broadcast_id = v_row.id and run.status in ('materialized', 'processing');
    get diagnostics v_run_updated = row_count;
    if v_run_updated <> 1 then
      raise exception using errcode = 'P0001', message = 'scheduled broadcast cancellation requires its automation run to be materialized or processing';
    end if;
  end if;
  return v_row;
end;
$$;

revoke all privileges on table public.scheduled_broadcast_attempt from public, anon, authenticated;
revoke all privileges on table public.scheduled_broadcast from public, anon, authenticated;

do $$
declare
  column_row record;
  table_name text;
begin
  foreach table_name in array array['scheduled_broadcast', 'scheduled_broadcast_attempt'] loop
    for column_row in
      select attname
      from pg_catalog.pg_attribute
      where attrelid = pg_catalog.to_regclass('public.' || table_name)
        and attnum > 0
        and not attisdropped
    loop
      execute format(
        'revoke select (%1$I), insert (%1$I), update (%1$I), references (%1$I) on table public.%2$I from public, anon, authenticated',
        column_row.attname,
        table_name
      );
    end loop;
  end loop;
end;
$$;

grant select, insert, update, delete on table public.scheduled_broadcast to service_role;
grant select, insert, update on table public.scheduled_broadcast_attempt to service_role;

revoke all on function public.maintain_scheduled_broadcast_lifecycle(integer, integer) from public, anon, authenticated;
revoke all on function public.claim_due_scheduled_broadcasts(text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.renew_scheduled_broadcast_lease(uuid, integer, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.mark_scheduled_broadcast_send_started(uuid, integer, uuid, text) from public, anon, authenticated;
revoke all on function public.complete_scheduled_broadcast(uuid, integer, uuid, text, text, jsonb, text, integer) from public, anon, authenticated;
revoke all on function public.edit_scheduled_broadcast(uuid, integer, uuid, timestamp with time zone, text, timestamp with time zone) from public, anon, authenticated;
revoke all on function public.cancel_scheduled_broadcast(uuid, integer, uuid, text) from public, anon, authenticated;

grant execute on function public.maintain_scheduled_broadcast_lifecycle(integer, integer) to service_role;
grant execute on function public.claim_due_scheduled_broadcasts(text, integer, integer, integer) to service_role;
grant execute on function public.renew_scheduled_broadcast_lease(uuid, integer, uuid, text, integer) to service_role;
grant execute on function public.mark_scheduled_broadcast_send_started(uuid, integer, uuid, text) to service_role;
grant execute on function public.complete_scheduled_broadcast(uuid, integer, uuid, text, text, jsonb, text, integer) to service_role;
grant execute on function public.edit_scheduled_broadcast(uuid, integer, uuid, timestamp with time zone, text, timestamp with time zone) to service_role;
grant execute on function public.cancel_scheduled_broadcast(uuid, integer, uuid, text) to service_role;

do $$
declare
  fn oid;
  table_name text;
  internal_column text;
begin
  foreach fn in array array[
    'public.maintain_scheduled_broadcast_lifecycle(integer,integer)'::regprocedure,
    'public.claim_due_scheduled_broadcasts(text,integer,integer,integer)'::regprocedure,
    'public.renew_scheduled_broadcast_lease(uuid,integer,uuid,text,integer)'::regprocedure,
    'public.mark_scheduled_broadcast_send_started(uuid,integer,uuid,text)'::regprocedure,
    'public.complete_scheduled_broadcast(uuid,integer,uuid,text,text,jsonb,text,integer)'::regprocedure,
    'public.edit_scheduled_broadcast(uuid,integer,uuid,timestamp with time zone,text,timestamp with time zone)'::regprocedure,
    'public.cancel_scheduled_broadcast(uuid,integer,uuid,text)'::regprocedure
  ] loop
    if exists (
      select 1
      from pg_catalog.pg_proc as proc
      cross join lateral pg_catalog.aclexplode(
        coalesce(proc.proacl, pg_catalog.acldefault('f', proc.proowner))
      ) as privilege
      where proc.oid = fn
        and privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    ) then
      raise exception using errcode = '42501', message = 'PUBLIC retains scheduled broadcast lifecycle RPC execute privilege';
    end if;
    if pg_catalog.has_function_privilege('anon', fn, 'EXECUTE') or pg_catalog.has_function_privilege('authenticated', fn, 'EXECUTE') then
      raise exception using errcode = '42501', message = 'scheduled broadcast lifecycle RPC is executable by a browser role';
    end if;
    if not pg_catalog.has_function_privilege('service_role', fn, 'EXECUTE') then
      raise exception using errcode = '42501', message = 'service_role lacks scheduled broadcast lifecycle RPC execute privilege';
    end if;
  end loop;

  foreach table_name in array array['scheduled_broadcast', 'scheduled_broadcast_attempt'] loop
    if not exists (
      select 1
      from pg_catalog.pg_class as class
      where class.oid = pg_catalog.to_regclass('public.' || table_name)
        and class.relrowsecurity
    ) then
      raise exception using errcode = '42501', message = 'scheduled broadcast lifecycle table must have RLS enabled';
    end if;
    if exists (
      select 1
      from pg_catalog.pg_class as class
      cross join lateral pg_catalog.aclexplode(
        coalesce(class.relacl, pg_catalog.acldefault('r', class.relowner))
      ) as privilege
      where class.oid = pg_catalog.to_regclass('public.' || table_name)
        and privilege.grantee = 0
        and privilege.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
    ) then
      raise exception using errcode = '42501', message = 'PUBLIC retains scheduled broadcast table privilege';
    end if;
  end loop;

  if pg_catalog.has_table_privilege('anon', 'public.scheduled_broadcast_attempt', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or pg_catalog.has_table_privilege('authenticated', 'public.scheduled_broadcast_attempt', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception using errcode = '42501', message = 'browser role retains scheduled broadcast attempt privilege';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'public.scheduled_broadcast_attempt'::pg_catalog.regclass
      and attribute.attnum > 0
      and not attribute.attisdropped
      and (
        pg_catalog.has_column_privilege('anon', 'public.scheduled_broadcast_attempt', attribute.attname, 'SELECT,INSERT,UPDATE,REFERENCES')
        or pg_catalog.has_column_privilege('authenticated', 'public.scheduled_broadcast_attempt', attribute.attname, 'SELECT,INSERT,UPDATE,REFERENCES')
      )
  ) then
    raise exception using errcode = '42501', message = 'browser role retains scheduled broadcast attempt column privilege';
  end if;

  if pg_catalog.has_table_privilege('anon', 'public.scheduled_broadcast', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or pg_catalog.has_table_privilege('authenticated', 'public.scheduled_broadcast', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception using errcode = '42501', message = 'browser role retains scheduled broadcast table privilege';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'public.scheduled_broadcast'::pg_catalog.regclass
      and attribute.attnum > 0
      and not attribute.attisdropped
      and (
        pg_catalog.has_column_privilege('anon', 'public.scheduled_broadcast', attribute.attname, 'SELECT,INSERT,UPDATE,REFERENCES')
        or pg_catalog.has_column_privilege('authenticated', 'public.scheduled_broadcast', attribute.attname, 'SELECT,INSERT,UPDATE,REFERENCES')
      )
  ) then
    raise exception using errcode = '42501', message = 'browser role retains scheduled broadcast column privilege';
  end if;

  foreach internal_column in array array[
    'claim_token', 'worker_id', 'claimed_at', 'claim_expires_at',
    'attempt_count', 'send_started_at', 'provider_result', 'next_attempt_at', 'last_error',
    'cancelled_by_user_id', 'organization_id', 'automation_run_id', 'result'
  ] loop
    if pg_catalog.has_column_privilege('anon', 'public.scheduled_broadcast', internal_column, 'SELECT')
       or pg_catalog.has_column_privilege('authenticated', 'public.scheduled_broadcast', internal_column, 'SELECT')
       or exists (
         select 1
         from pg_catalog.pg_attribute as attribute
         cross join lateral pg_catalog.aclexplode(
           coalesce(attribute.attacl, array[]::pg_catalog.aclitem[])
         ) as privilege
         where attribute.attrelid = 'public.scheduled_broadcast'::pg_catalog.regclass
           and attribute.attname = internal_column
           and privilege.grantee = 0
           and privilege.privilege_type = 'SELECT'
       ) then
      raise exception using errcode = '42501', message = 'scheduled broadcast internal column is readable by a browser role or PUBLIC';
    end if;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    cross join lateral pg_catalog.aclexplode(
      coalesce(attribute.attacl, array[]::pg_catalog.aclitem[])
    ) as privilege
    where attribute.attrelid in (
      'public.scheduled_broadcast'::pg_catalog.regclass,
      'public.scheduled_broadcast_attempt'::pg_catalog.regclass
    )
      and attribute.attnum > 0
      and not attribute.attisdropped
      and privilege.grantee = 0
      and privilege.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
  ) then
    raise exception using errcode = '42501', message = 'PUBLIC retains scheduled broadcast column privilege';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policy
    where polrelid in (
      'public.scheduled_broadcast'::pg_catalog.regclass,
      'public.scheduled_broadcast_attempt'::pg_catalog.regclass
    )
  ) then
    raise exception using errcode = '42501', message = 'scheduled broadcast lifecycle tables must not have browser RLS policies';
  end if;
end;
$$;

commit;
