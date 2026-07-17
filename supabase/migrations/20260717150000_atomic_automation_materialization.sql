-- Make automation-run materialization atomic and structurally idempotent.
-- This migration intentionally does not backfill or reconcile historical rows.

begin;

-- Aggregate-only preflight. These notices expose counts, never customer data,
-- payloads, run IDs, broadcast IDs, or external identifiers.
do $$
declare
  v_duplicate_payload_groups bigint;
  v_missing_linked_broadcasts bigint;
  v_cross_organization_links bigint;
  v_shared_broadcast_groups bigint;
  v_automation_broadcasts_without_valid_run bigint;
begin
  select count(*)
  into v_duplicate_payload_groups
  from (
    select sb.payload ->> 'automationRunId' as run_reference
    from public.scheduled_broadcast as sb
    where pg_catalog.jsonb_typeof(sb.payload) = 'object'
      and nullif(sb.payload ->> 'automationRunId', '') is not null
    group by sb.payload ->> 'automationRunId'
    having count(*) > 1
  ) as duplicate_groups;

  select count(*)
  into v_missing_linked_broadcasts
  from public.automation_run as ar
  left join public.scheduled_broadcast as sb
    on sb.id = ar.scheduled_broadcast_id
  where ar.scheduled_broadcast_id is not null
    and sb.id is null;

  select count(*)
  into v_cross_organization_links
  from public.automation_run as ar
  join public.scheduled_broadcast as sb
    on sb.id = ar.scheduled_broadcast_id
  where sb.organization_id <> ar.organization_id;

  select count(*)
  into v_shared_broadcast_groups
  from (
    select ar.scheduled_broadcast_id
    from public.automation_run as ar
    where ar.scheduled_broadcast_id is not null
    group by ar.scheduled_broadcast_id
    having count(*) > 1
  ) as shared_groups;

  with payload_candidates as (
    select
      sb.organization_id,
      case
        when (sb.payload ->> 'automationRunId') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (sb.payload ->> 'automationRunId')::uuid
        else null::uuid
      end as run_id
    from public.scheduled_broadcast as sb
    where pg_catalog.jsonb_typeof(sb.payload) = 'object'
      and sb.payload ? 'automationRunId'
  )
  select count(*)
  into v_automation_broadcasts_without_valid_run
  from payload_candidates as candidate
  left join public.automation_run as ar
    on ar.id = candidate.run_id
    and ar.organization_id = candidate.organization_id
  where candidate.run_id is null
    or ar.id is null;

  raise notice
      'Atomic automation materialization preflight: duplicate payload run-reference groups=%',
    v_duplicate_payload_groups;
  raise notice
      'Atomic automation materialization preflight: runs pointing to missing broadcasts=%',
    v_missing_linked_broadcasts;
  raise notice
      'Atomic automation materialization preflight: cross-organization run/broadcast links=%',
    v_cross_organization_links;
  raise notice
      'Atomic automation materialization preflight: broadcasts referenced by multiple runs=%',
    v_shared_broadcast_groups;
  raise notice
      'Atomic automation materialization preflight: automation payload broadcasts without a valid same-organization run=%',
    v_automation_broadcasts_without_valid_run;
end
$$;

-- NULL keeps manual and historical broadcasts compatible. A normal UNIQUE
-- constraint permits multiple NULL values but at most one non-NULL run ID.
alter table public.scheduled_broadcast
  add column automation_run_id uuid null,
  add constraint scheduled_broadcast_automation_run_id_fkey
    foreign key (automation_run_id)
    references public.automation_run (id)
    on delete set null,
  add constraint scheduled_broadcast_automation_run_id_key
    unique (automation_run_id);

comment on column public.scheduled_broadcast.automation_run_id is
  'Structural origin for automation materialization. NULL denotes manual or historical broadcasts.';

create or replace function public.materialize_automation_run(
  p_automation_run_id uuid,
  p_organization_id integer,
  p_channel text,
  p_scheduled_for timestamp with time zone,
  p_recipient_count integer,
  p_payload jsonb
)
returns table (
  outcome text,
  run_id uuid,
  broadcast_id uuid,
  run_status text,
  broadcast_status text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run public.automation_run%rowtype;
  v_broadcast public.scheduled_broadcast%rowtype;
  v_payload jsonb;
  v_updated_count integer;
begin
  if current_user <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'materialize_automation_run is restricted to service_role';
  end if;

  if p_automation_run_id is null
     or p_organization_id is null
     or p_channel is null
     or p_scheduled_for is null
     or p_recipient_count is null
     or p_payload is null then
    raise exception using
      errcode = '22004',
      message = 'materialize_automation_run requires non-NULL arguments';
  end if;

  if p_recipient_count < 1 then
    raise exception using
      errcode = '22023',
      message = 'materialize_automation_run recipient_count must be positive';
  end if;

  if pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'materialize_automation_run payload must be a JSON object';
  end if;

  select ar.*
  into v_run
  from public.automation_run as ar
  where ar.id = p_automation_run_id
  for update of ar;

  if not found then
    return query
    select
      'not_found'::text,
      p_automation_run_id,
      null::uuid,
      null::text,
      null::text;
    return;
  end if;

  -- Trust the locked database row, not the caller-provided tenant/channel/time.
  if v_run.organization_id <> p_organization_id then
    return query
    select
      'organization_mismatch'::text,
      v_run.id,
      null::uuid,
      v_run.status,
      null::text;
    return;
  end if;

  if v_run.channel <> p_channel then
    raise exception using
      errcode = '22023',
      message = 'materialize_automation_run channel does not match the run';
  end if;

  if v_run.scheduled_for <> p_scheduled_for then
    raise exception using
      errcode = '22023',
      message = 'materialize_automation_run scheduled_for does not match the run';
  end if;

  -- Preserve legacy readers while ensuring the locked row, not the caller,
  -- defines the tenant and automation origin duplicated inside the payload.
  v_payload := p_payload || pg_catalog.jsonb_build_object(
    'orgId',
    v_run.organization_id,
    'automationRunId',
    v_run.id
  );

  if v_run.status <> 'queued' then
    if v_run.scheduled_broadcast_id is not null
       or v_run.status in ('materialized', 'processing', 'sent') then
      select sb.*
      into v_broadcast
      from public.scheduled_broadcast as sb
      where sb.id = v_run.scheduled_broadcast_id;

      return query
      select
        'already_materialized'::text,
        v_run.id,
        v_run.scheduled_broadcast_id,
        v_run.status,
        v_broadcast.status;
    else
      return query
      select
        'claim_lost'::text,
        v_run.id,
        null::uuid,
        v_run.status,
        null::text;
    end if;
    return;
  end if;

  if v_run.scheduled_for > pg_catalog.now() then
    return query
    select
      'not_due'::text,
      v_run.id,
      null::uuid,
      v_run.status,
      null::text;
    return;
  end if;

  if v_run.scheduled_broadcast_id is not null then
    select sb.*
    into v_broadcast
    from public.scheduled_broadcast as sb
    where sb.id = v_run.scheduled_broadcast_id;

    return query
    select
      'already_materialized'::text,
      v_run.id,
      v_run.scheduled_broadcast_id,
      v_run.status,
      v_broadcast.status;
    return;
  end if;

  -- Defensive idempotency check for retries or manually reconciled rows.
  select sb.*
  into v_broadcast
  from public.scheduled_broadcast as sb
  where sb.automation_run_id = v_run.id;

  if found then
    return query
    select
      'already_materialized'::text,
      v_run.id,
      v_broadcast.id,
      v_run.status,
      v_broadcast.status;
    return;
  end if;

  insert into public.scheduled_broadcast (
    organization_id,
    channel,
    status,
    scheduled_for,
    payload,
    recipient_count,
    automation_run_id
  )
  values (
    v_run.organization_id,
    v_run.channel,
    'queued',
    v_run.scheduled_for,
    v_payload,
    p_recipient_count,
    v_run.id
  )
  returning * into v_broadcast;

  update public.automation_run as ar
  set
    status = 'materialized',
    scheduled_broadcast_id = v_broadcast.id,
    processed_at = pg_catalog.now(),
    updated_at = pg_catalog.now()
  where ar.id = v_run.id
    and ar.organization_id = v_run.organization_id
    and ar.status = 'queued'
    and ar.scheduled_broadcast_id is null;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = '40001',
      message = 'materialize_automation_run lost ownership after insert';
  end if;

  return query
  select
    'materialized'::text,
    v_run.id,
    v_broadcast.id,
    'materialized'::text,
    v_broadcast.status;
end;
$$;

comment on function public.materialize_automation_run(
  uuid,
  integer,
  text,
  timestamp with time zone,
  integer,
  jsonb
) is
  'Atomic claim, scheduled broadcast insert, and automation run finalization.';

-- SECURITY INVOKER requires explicit table privileges for the service role.
grant select, update on table public.automation_run to service_role;
grant select, insert on table public.scheduled_broadcast to service_role;

revoke all privileges on function public.materialize_automation_run(
  uuid,
  integer,
  text,
  timestamp with time zone,
  integer,
  jsonb
) from public, anon, authenticated;

grant execute on function public.materialize_automation_run(
  uuid,
  integer,
  text,
  timestamp with time zone,
  integer,
  jsonb
) to service_role;

-- Fail closed if the new schema or effective RPC privileges differ from the
-- intended final state. This validates inherited privileges as well as ACLs.
do $$
declare
  v_function oid := 'public.materialize_automation_run(uuid,integer,text,timestamp with time zone,integer,jsonb)'::regprocedure::oid;
begin
  if not exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'public.scheduled_broadcast'::regclass
      and attribute.attname = 'automation_run_id'
      and attribute.atttypid = 'uuid'::regtype
      and not attribute.attnotnull
      and not attribute.attisdropped
  ) then
    raise exception using
      errcode = '42703',
      message = 'Atomic automation materialization validation failed: nullable scheduled_broadcast.automation_run_id is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.scheduled_broadcast'::regclass
      and constraint_row.conname = 'scheduled_broadcast_automation_run_id_fkey'
      and constraint_row.contype = 'f'
  ) then
    raise exception using
      errcode = '42710',
      message = 'Atomic automation materialization validation failed: automation_run_id FK is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.scheduled_broadcast'::regclass
      and constraint_row.conname = 'scheduled_broadcast_automation_run_id_key'
      and constraint_row.contype = 'u'
  ) then
    raise exception using
      errcode = '42710',
      message = 'Atomic automation materialization validation failed: automation_run_id UNIQUE is missing';
  end if;

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
  ) then
    raise exception using
      errcode = '42501',
      message = 'Atomic automation materialization validation failed: PUBLIC can execute materialize_automation_run';
  end if;

  if pg_catalog.has_function_privilege('anon', v_function, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', v_function, 'EXECUTE') then
    raise exception using
      errcode = '42501',
      message = 'Atomic automation materialization validation failed: a browser role can execute materialize_automation_run';
  end if;

  if not pg_catalog.has_function_privilege('service_role', v_function, 'EXECUTE') then
    raise exception using
      errcode = '42501',
      message = 'Atomic automation materialization validation failed: service_role cannot execute materialize_automation_run';
  end if;

  if not pg_catalog.has_table_privilege(
    'service_role',
    'public.automation_run',
    'SELECT'
  ) or not pg_catalog.has_table_privilege(
    'service_role',
    'public.automation_run',
    'UPDATE'
  ) or not pg_catalog.has_table_privilege(
    'service_role',
    'public.scheduled_broadcast',
    'SELECT'
  ) or not pg_catalog.has_table_privilege(
    'service_role',
    'public.scheduled_broadcast',
    'INSERT'
  ) then
    raise exception using
      errcode = '42501',
      message = 'Atomic automation materialization validation failed: service_role lacks required table privileges';
  end if;
end
$$;

commit;
