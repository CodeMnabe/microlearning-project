-- Persistent, service-role-only ledger for immediate WhatsApp and Teams broadcasts.
create table if not exists public.immediate_broadcast_request (
  id uuid primary key default gen_random_uuid(),
  organization_id integer not null references public.organization(id) on delete cascade,
  created_by_user_id uuid not null,
  channel text not null check (channel in ('whatsapp', 'teams')),
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 128),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'reserving' check (status in ('reserving','processing','completed','partial','failed','unknown_outcome')),
  recipient_count integer not null check (recipient_count between 1 and 500),
  claim_token uuid,
  worker_id text,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  send_started_at timestamptz,
  completed_at timestamptz,
  result_summary jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (organization_id, created_by_user_id, channel, idempotency_key)
);

create table if not exists public.immediate_broadcast_delivery (
  id uuid primary key default gen_random_uuid(),
  organization_id integer not null references public.organization(id) on delete cascade,
  broadcast_request_id uuid not null references public.immediate_broadcast_request(id) on delete cascade,
  user_id integer not null references public."user"(id) on delete restrict,
  recipient_identity_hash text not null,
  ordinal integer not null check (ordinal >= 1),
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','unknown_outcome')),
  claim_token uuid,
  worker_id text,
  claim_expires_at timestamptz,
  send_started_at timestamptz,
  provider_message_id text,
  provider_result jsonb not null default '{}'::jsonb,
  constraint immediate_broadcast_delivery_provider_result_size check (pg_column_size(provider_result) <= 16384),
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (broadcast_request_id, user_id),
  unique (broadcast_request_id, ordinal)
);

do $$ begin
  if pg_catalog.to_regclass('auth.users') is not null and not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid='public.immediate_broadcast_request'::pg_catalog.regclass
      and conname='immediate_broadcast_request_created_by_user_id_fkey'
  ) then
    alter table public.immediate_broadcast_request
      add constraint immediate_broadcast_request_created_by_user_id_fkey
      foreign key (created_by_user_id) references auth.users(id) on delete restrict;
  end if;
end $$;

create index if not exists immediate_broadcast_delivery_claim_idx
  on public.immediate_broadcast_delivery (broadcast_request_id, status, claim_expires_at);
create unique index if not exists user_id_organization_unique on public."user" (id, organization_id);
do $$ begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.immediate_broadcast_delivery'::pg_catalog.regclass
      and conname = 'immediate_broadcast_delivery_user_organization_fk'
  ) then
    alter table public.immediate_broadcast_delivery
      add constraint immediate_broadcast_delivery_user_organization_fk
      foreign key (user_id, organization_id) references public."user"(id, organization_id) on delete restrict;
  end if;
end $$;

alter table public.tracked_link add column if not exists immediate_broadcast_delivery_id uuid
  references public.immediate_broadcast_delivery(id) on delete set null;
create unique index if not exists tracked_link_immediate_delivery_key_unique
  on public.tracked_link (immediate_broadcast_delivery_id, link_key)
  where immediate_broadcast_delivery_id is not null;
revoke select, insert, update on table public.tracked_link from public, anon, authenticated;
revoke select (immediate_broadcast_delivery_id), insert (immediate_broadcast_delivery_id), update (immediate_broadcast_delivery_id)
  on table public.tracked_link from public, anon, authenticated;

create or replace function public.refresh_immediate_broadcast_request(p_request_id uuid)
returns public.immediate_broadcast_request
language plpgsql security invoker set search_path = '' as $$
declare v_request public.immediate_broadcast_request%rowtype; v_sent integer; v_failed integer; v_unknown integer; v_total integer; v_terminal integer; v_status text; v_bad_ledger boolean;
begin
  select * into v_request from public.immediate_broadcast_request where id = p_request_id for update;
  if not found then raise exception using errcode='22023', message='immediate broadcast request does not exist'; end if;
  select count(*), count(*) filter (where status = 'sent'), count(*) filter (where status = 'failed'), count(*) filter (where status = 'unknown_outcome')
    into v_total, v_sent, v_failed, v_unknown from public.immediate_broadcast_delivery where broadcast_request_id = p_request_id;
  select exists (
    select 1 from public.immediate_broadcast_delivery as delivery
    where delivery.broadcast_request_id=p_request_id and delivery.organization_id<>v_request.organization_id
  ) or v_total<>v_request.recipient_count or
  (select count(distinct ordinal) from public.immediate_broadcast_delivery where broadcast_request_id=p_request_id)<>v_total or
  (select min(ordinal) from public.immediate_broadcast_delivery where broadcast_request_id=p_request_id)<>1 or
  (select max(ordinal) from public.immediate_broadcast_delivery where broadcast_request_id=p_request_id)<>v_request.recipient_count
  into v_bad_ledger;
  if v_bad_ledger then raise exception using errcode='23514', message='immediate broadcast delivery ledger invariant failed'; end if;
  v_terminal:=v_sent+v_failed+v_unknown;
  if v_terminal<v_request.recipient_count then return v_request; end if;
  if v_terminal<>v_request.recipient_count then raise exception using errcode='23514', message='immediate broadcast terminal summary invariant failed'; end if;
  if v_unknown > 0 then v_status := 'unknown_outcome';
  elsif v_sent = v_total then v_status := 'completed';
  elsif v_sent > 0 and v_failed > 0 then v_status := 'partial';
  elsif v_failed = v_total then v_status := 'failed';
  else return v_request; end if;
  update public.immediate_broadcast_request set status=v_status, completed_at=pg_catalog.now(), claim_token=null, worker_id=null, claim_expires_at=null,
    result_summary=jsonb_build_object('sent',v_sent,'failed',v_failed,'unknown_outcome',v_unknown,'recipient_count',v_total), updated_at=pg_catalog.now()
  where id=p_request_id returning * into v_request;
  return v_request;
end $$;

create or replace function public.reserve_immediate_broadcast_request(
  p_organization_id integer, p_actor_user_id uuid, p_channel text, p_idempotency_key text, p_request_hash text,
  p_recipient_user_ids integer[], p_worker_id text, p_lease_seconds integer default 120)
returns table(request_id uuid, channel text, status text, recipient_count integer, owner boolean, request_claim_token uuid, worker_id text, claim_expires_at timestamptz, sent_count integer, failed_count integer, unknown_count integer, created_at timestamptz, completed_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare v_request public.immediate_broadcast_request%rowtype; v_count integer; v_distinct_count integer; v_now timestamptz := pg_catalog.now();
begin
  if current_user <> 'service_role' then raise exception using errcode='42501', message='reserve_immediate_broadcast_request is restricted to service_role'; end if;
  if p_channel not in ('whatsapp','teams') or p_lease_seconds < 1 or p_lease_seconds > 120 or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$' or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023', message='immediate broadcast request is invalid'; end if;
  if not exists (select 1 from public.organization as org_row where org_row.id=p_organization_id and org_row.owner_user_id=p_actor_user_id) then
    raise exception using errcode='42501', message='immediate broadcast actor does not own organization'; end if;
  select count(*), count(distinct value) into v_count, v_distinct_count from unnest(p_recipient_user_ids) as value;
  if v_count < 1 or v_count > 500 or v_count <> v_distinct_count or array_length(p_recipient_user_ids,1) <> v_count then raise exception using errcode='22023', message='immediate broadcast recipients are invalid'; end if;
  if (select count(*) from public."user" as user_row where user_row.organization_id=p_organization_id and user_row.id=any(p_recipient_user_ids)) <> v_count then
    raise exception using errcode='22023', message='immediate broadcast recipients do not belong to organization'; end if;
  insert into public.immediate_broadcast_request(organization_id,created_by_user_id,channel,idempotency_key,request_hash,recipient_count)
  values(p_organization_id,p_actor_user_id,p_channel,p_idempotency_key,p_request_hash,v_count)
  on conflict (organization_id,created_by_user_id,channel,idempotency_key) do nothing;
  select * into v_request from public.immediate_broadcast_request where organization_id=p_organization_id and created_by_user_id=p_actor_user_id and channel=p_channel and idempotency_key=p_idempotency_key for update;
  if v_request.request_hash <> p_request_hash then raise exception using errcode='P0001', message='IDEMPOTENCY_PAYLOAD_MISMATCH'; end if;
  request_id:=v_request.id; channel:=v_request.channel; status:=v_request.status; recipient_count:=v_request.recipient_count; created_at:=v_request.created_at; completed_at:=v_request.completed_at;
  select count(*) filter(where status='sent'),count(*) filter(where status='failed'),count(*) filter(where status='unknown_outcome') into sent_count,failed_count,unknown_count from public.immediate_broadcast_delivery where broadcast_request_id=v_request.id;
  if v_request.status in ('completed','partial','failed','unknown_outcome') then owner:=false; return next; return; end if;
  if v_request.claim_expires_at is not null and v_request.claim_expires_at >= v_now then owner:=false; request_claim_token:=null; worker_id:=null; claim_expires_at:=v_request.claim_expires_at; return next; return; end if;
  update public.immediate_broadcast_request set status='processing',claim_token=gen_random_uuid(),worker_id=p_worker_id,claimed_at=v_now,claim_expires_at=v_now+make_interval(secs=>p_lease_seconds),updated_at=v_now where id=v_request.id returning * into v_request;
  insert into public.immediate_broadcast_delivery(organization_id,broadcast_request_id,user_id,recipient_identity_hash,ordinal)
  select p_organization_id,v_request.id,value,pg_catalog.md5(value::text),ordinality::integer from unnest(p_recipient_user_ids) with ordinality as t(value,ordinality)
  on conflict (broadcast_request_id,user_id) do nothing;
  -- The caller owns the request now; only it may recover expired delivery claims.
  update public.immediate_broadcast_delivery set status=case when send_started_at is null then 'pending' else 'unknown_outcome' end,
    claim_token=null,worker_id=null,claim_expires_at=null,completed_at=case when send_started_at is null then null else v_now end,updated_at=v_now
  where broadcast_request_id=v_request.id and status='processing' and claim_expires_at < v_now;
  perform public.refresh_immediate_broadcast_request(v_request.id);
  select * into v_request from public.immediate_broadcast_request where id=v_request.id for update;
  request_id:=v_request.id; channel:=v_request.channel; status:=v_request.status; recipient_count:=v_request.recipient_count; request_claim_token:=v_request.claim_token; worker_id:=v_request.worker_id; claim_expires_at:=v_request.claim_expires_at; created_at:=v_request.created_at; completed_at:=v_request.completed_at;
  select count(*) filter(where status='sent'),count(*) filter(where status='failed'),count(*) filter(where status='unknown_outcome') into sent_count,failed_count,unknown_count from public.immediate_broadcast_delivery where broadcast_request_id=v_request.id;
  if v_request.status in ('completed','partial','failed','unknown_outcome') then owner:=false; request_claim_token:=null; worker_id:=null; claim_expires_at:=null; return next; return; end if;
  owner:=true; return next;
end $$;

create or replace function public.claim_immediate_broadcast_delivery(p_request_id uuid,p_organization_id integer,p_actor_user_id uuid,p_request_claim_token uuid,p_user_id integer,p_worker_id text,p_lease_seconds integer default 120)
returns table(outcome text,delivery_id uuid,claim_token uuid)
language plpgsql security invoker set search_path = '' as $$
declare v_request public.immediate_broadcast_request%rowtype; v_delivery public.immediate_broadcast_delivery%rowtype; v_now timestamptz:=pg_catalog.now();
begin
  if current_user <> 'service_role' then raise exception using errcode='42501', message='claim_immediate_broadcast_delivery is restricted to service_role'; end if;
  select * into v_request from public.immediate_broadcast_request where id=p_request_id and organization_id=p_organization_id and created_by_user_id=p_actor_user_id for update;
  if not found or v_request.status <> 'processing' or v_request.claim_token <> p_request_claim_token or v_request.worker_id <> p_worker_id or v_request.claim_expires_at < v_now then outcome:='not_claimed'; return next; return; end if;
  select * into v_delivery from public.immediate_broadcast_delivery where broadcast_request_id=p_request_id and organization_id=p_organization_id and user_id=p_user_id for update;
  if not found then outcome:='not_found'; return next; return; end if;
  if v_delivery.status <> 'pending' then outcome:=v_delivery.status; delivery_id:=v_delivery.id; return next; return; end if;
  update public.immediate_broadcast_delivery set status='processing',claim_token=gen_random_uuid(),worker_id=p_worker_id,claim_expires_at=v_now+make_interval(secs=>p_lease_seconds),updated_at=v_now where id=v_delivery.id returning id,claim_token into delivery_id,claim_token;
  outcome:='claimed'; return next;
end $$;

create or replace function public.mark_immediate_broadcast_delivery_send_started(p_delivery_id uuid,p_request_id uuid,p_organization_id integer,p_request_claim_token uuid,p_claim_token uuid,p_worker_id text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_now timestamptz:=pg_catalog.now(); v_request public.immediate_broadcast_request%rowtype; v_delivery public.immediate_broadcast_delivery%rowtype; begin
  if current_user <> 'service_role' then raise exception using errcode='42501', message='mark_immediate_broadcast_delivery_send_started is restricted to service_role'; end if;
  select * into v_request from public.immediate_broadcast_request where id=p_request_id and organization_id=p_organization_id for update;
  if not found or v_request.status<>'processing' or v_request.claim_token<>p_request_claim_token or v_request.worker_id<>p_worker_id or v_request.claim_expires_at<v_now then return false; end if;
  select * into v_delivery from public.immediate_broadcast_delivery where id=p_delivery_id and broadcast_request_id=p_request_id and organization_id=p_organization_id for update;
  if not found or v_delivery.status<>'processing' or v_delivery.claim_token<>p_claim_token or v_delivery.worker_id<>p_worker_id or v_delivery.claim_expires_at<v_now then return false; end if;
  update public.immediate_broadcast_delivery set send_started_at=coalesce(send_started_at,v_now),updated_at=v_now where id=p_delivery_id;
  update public.immediate_broadcast_request set send_started_at=coalesce(send_started_at,v_now),updated_at=v_now where id=p_request_id and organization_id=p_organization_id;
  return true;
end $$;

create or replace function public.renew_immediate_broadcast_request_lease(p_request_id uuid,p_organization_id integer,p_actor_user_id uuid,p_request_claim_token uuid,p_worker_id text,p_lease_seconds integer default 120)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_now timestamptz:=pg_catalog.now(); begin
  if current_user <> 'service_role' or p_lease_seconds < 1 or p_lease_seconds > 120 then raise exception using errcode='22023', message='immediate broadcast heartbeat is invalid'; end if;
  update public.immediate_broadcast_request set claim_expires_at=v_now+make_interval(secs=>p_lease_seconds),updated_at=v_now
  where id=p_request_id and organization_id=p_organization_id and created_by_user_id=p_actor_user_id and status='processing' and claim_token=p_request_claim_token and worker_id=p_worker_id and claim_expires_at>=v_now;
  return found;
end $$;

create or replace function public.complete_immediate_broadcast_delivery(p_delivery_id uuid,p_request_id uuid,p_organization_id integer,p_request_claim_token uuid,p_claim_token uuid,p_worker_id text,p_outcome text,p_provider_message_id text,p_provider_result jsonb,p_last_error text)
returns table(request_id uuid,channel text,status text,recipient_count integer,sent_count integer,failed_count integer,unknown_count integer,created_at timestamptz,completed_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare v_request public.immediate_broadcast_request%rowtype; v_delivery public.immediate_broadcast_delivery%rowtype; v_now timestamptz:=pg_catalog.now(); v_effective_outcome text; v_provider_message_id text; begin
  if current_user <> 'service_role' or p_outcome not in ('sent','failed','unknown_outcome') then raise exception using errcode='22023', message='immediate broadcast completion is invalid'; end if;
  if pg_column_size(coalesce(p_provider_result,'{}'::jsonb))>16384 then raise exception using errcode='22023', message='provider result exceeds limit'; end if;
  select * into v_request from public.immediate_broadcast_request where id=p_request_id and organization_id=p_organization_id for update;
  if not found or v_request.status<>'processing' or v_request.claim_token<>p_request_claim_token or v_request.worker_id<>p_worker_id or v_request.claim_expires_at<v_now then return; end if;
  select * into v_delivery from public.immediate_broadcast_delivery where id=p_delivery_id and broadcast_request_id=p_request_id and organization_id=p_organization_id for update;
  if not found or v_delivery.status<>'processing' or v_delivery.claim_token<>p_claim_token or v_delivery.worker_id<>p_worker_id then return; end if;
  v_provider_message_id:=nullif(btrim(p_provider_message_id),'');
  if v_delivery.send_started_at is null then if p_outcome<>'failed' then raise exception using errcode='22023', message='pre-send delivery may only fail'; end if; v_effective_outcome:='failed';
  elsif p_outcome='sent' and v_provider_message_id is not null then v_effective_outcome:='sent'; else v_effective_outcome:='unknown_outcome'; end if;
  update public.immediate_broadcast_delivery set status=v_effective_outcome,provider_message_id=case when v_effective_outcome='sent' then left(v_provider_message_id,512) else null end,provider_result=coalesce(p_provider_result,'{}'::jsonb),last_error=case when v_effective_outcome='sent' then null else left(p_last_error,1024) end,completed_at=v_now,claim_token=null,worker_id=null,claim_expires_at=null,updated_at=v_now where id=p_delivery_id;
  select * into v_request from public.refresh_immediate_broadcast_request(p_request_id);
  request_id:=v_request.id;channel:=v_request.channel;status:=v_request.status;recipient_count:=v_request.recipient_count;created_at:=v_request.created_at;completed_at:=v_request.completed_at;
  select count(*)filter(where status='sent'),count(*)filter(where status='failed'),count(*)filter(where status='unknown_outcome') into sent_count,failed_count,unknown_count from public.immediate_broadcast_delivery where broadcast_request_id=p_request_id; return next;
end $$;

create or replace function public.get_immediate_broadcast_request_summary(p_request_id uuid,p_organization_id integer,p_actor_user_id uuid)
returns table(request_id uuid,channel text,status text,recipient_count integer,sent_count integer,failed_count integer,unknown_count integer,created_at timestamptz,completed_at timestamptz)
language sql security invoker set search_path = '' as $$
  select r.id,r.channel,r.status,r.recipient_count,count(d.id) filter(where d.status='sent')::integer,count(d.id) filter(where d.status='failed')::integer,count(d.id) filter(where d.status='unknown_outcome')::integer,r.created_at,r.completed_at
  from public.immediate_broadcast_request r left join public.immediate_broadcast_delivery d on d.broadcast_request_id=r.id
  where r.id=p_request_id and r.organization_id=p_organization_id and r.created_by_user_id=p_actor_user_id group by r.id;
$$;

create or replace function public.recover_immediate_broadcast_request(p_request_id uuid,p_organization_id integer,p_actor_user_id uuid,p_request_claim_token uuid,p_worker_id text,p_lease_seconds integer default 120,p_limit integer default 500)
returns public.immediate_broadcast_request language plpgsql security invoker set search_path = '' as $$
declare v_request public.immediate_broadcast_request%rowtype; v_now timestamptz:=pg_catalog.now(); begin
  if current_user <> 'service_role' then raise exception using errcode='42501', message='recover_immediate_broadcast_request is restricted to service_role'; end if;
  select * into v_request from public.immediate_broadcast_request where id=p_request_id and organization_id=p_organization_id and created_by_user_id=p_actor_user_id for update;
  if not found then return null; end if;
  if v_request.status<>'processing' or v_request.claim_token<>p_request_claim_token or v_request.worker_id<>p_worker_id or v_request.claim_expires_at<v_now then return v_request; end if;
  update public.immediate_broadcast_delivery set status=case when send_started_at is null then 'pending' else 'unknown_outcome' end,claim_token=null,worker_id=null,claim_expires_at=null,completed_at=case when send_started_at is null then null else pg_catalog.now() end,updated_at=pg_catalog.now()
  where id in (select id from public.immediate_broadcast_delivery where broadcast_request_id=p_request_id and status='processing' and claim_expires_at<v_now order by id limit least(greatest(p_limit,1),500));
  return public.refresh_immediate_broadcast_request(p_request_id);
end $$;

alter table public.immediate_broadcast_request enable row level security;
alter table public.immediate_broadcast_delivery enable row level security;
revoke all privileges on table public.immediate_broadcast_request, public.immediate_broadcast_delivery from public, anon, authenticated;
grant select,insert,update,delete on table public.immediate_broadcast_request, public.immediate_broadcast_delivery to service_role;
revoke all on function public.refresh_immediate_broadcast_request(uuid), public.reserve_immediate_broadcast_request(integer,uuid,text,text,text,integer[],text,integer), public.claim_immediate_broadcast_delivery(uuid,integer,uuid,uuid,integer,text,integer), public.mark_immediate_broadcast_delivery_send_started(uuid,uuid,integer,uuid,uuid,text), public.renew_immediate_broadcast_request_lease(uuid,integer,uuid,uuid,text,integer), public.complete_immediate_broadcast_delivery(uuid,uuid,integer,uuid,uuid,text,text,text,jsonb,text), public.get_immediate_broadcast_request_summary(uuid,integer,uuid), public.recover_immediate_broadcast_request(uuid,integer,uuid,uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.refresh_immediate_broadcast_request(uuid), public.reserve_immediate_broadcast_request(integer,uuid,text,text,text,integer[],text,integer), public.claim_immediate_broadcast_delivery(uuid,integer,uuid,uuid,integer,text,integer), public.mark_immediate_broadcast_delivery_send_started(uuid,uuid,integer,uuid,uuid,text), public.renew_immediate_broadcast_request_lease(uuid,integer,uuid,uuid,text,integer), public.complete_immediate_broadcast_delivery(uuid,uuid,integer,uuid,uuid,text,text,text,jsonb,text), public.get_immediate_broadcast_request_summary(uuid,integer,uuid), public.recover_immediate_broadcast_request(uuid,integer,uuid,uuid,text,integer,integer) to service_role;

-- Fail the migration if any browser role (or PUBLIC/grantee 0) can reach this ledger.
do $$
declare
  v_table regclass;
  v_function oid;
  v_role name;
begin
  foreach v_table in array array[
    'public.immediate_broadcast_request'::regclass,
    'public.immediate_broadcast_delivery'::regclass
  ] loop
    if not (select relrowsecurity from pg_catalog.pg_class where oid=v_table) then
      raise exception using errcode='42501', message='immediate broadcast RLS is disabled';
    end if;
    if exists (select 1 from pg_catalog.pg_policy where polrelid=v_table) then
      raise exception using errcode='42501', message='immediate broadcast browser policy exists';
    end if;
    if exists (
      select 1
      from pg_catalog.pg_class as class_row
      cross join lateral pg_catalog.aclexplode(coalesce(class_row.relacl, pg_catalog.acldefault('r', class_row.relowner))) as privilege
      where class_row.oid=v_table and privilege.grantee=0
        and privilege.privilege_type in ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
    ) then raise exception using errcode='42501', message='PUBLIC has immediate broadcast table access'; end if;
    foreach v_role in array array['anon','authenticated'] loop
      if has_table_privilege(v_role,v_table,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
        raise exception using errcode='42501', message='browser role has immediate broadcast table access';
      end if;
    end loop;
  end loop;
  if exists (
    select 1 from pg_catalog.pg_attribute as attribute_row
    join pg_catalog.pg_class as class_row on class_row.oid=attribute_row.attrelid
    cross join lateral pg_catalog.aclexplode(coalesce(attribute_row.attacl, pg_catalog.acldefault('c', class_row.relowner))) as privilege
    where class_row.oid='public.tracked_link'::regclass and attribute_row.attname='immediate_broadcast_delivery_id'
      and privilege.grantee=0 and privilege.privilege_type in ('SELECT','INSERT','UPDATE')
  ) then raise exception using errcode='42501', message='PUBLIC has immediate broadcast delivery column access'; end if;
  if exists (
    select 1 from pg_catalog.pg_class as class_row
    cross join lateral pg_catalog.aclexplode(coalesce(class_row.relacl, pg_catalog.acldefault('r', class_row.relowner))) as privilege
    where class_row.oid='public.tracked_link'::regclass and privilege.grantee=0 and privilege.privilege_type in ('SELECT','INSERT','UPDATE')
  ) then raise exception using errcode='42501', message='PUBLIC table grant exposes immediate broadcast delivery column'; end if;
  foreach v_role in array array['anon','authenticated'] loop
    if has_column_privilege(v_role,'public.tracked_link','immediate_broadcast_delivery_id','SELECT,INSERT,UPDATE') then
      raise exception using errcode='42501', message='browser role has immediate broadcast delivery column access';
    end if;
  end loop;
  foreach v_function in array array[
    'public.refresh_immediate_broadcast_request(uuid)'::regprocedure,
    'public.reserve_immediate_broadcast_request(integer,uuid,text,text,text,integer[],text,integer)'::regprocedure,
    'public.claim_immediate_broadcast_delivery(uuid,integer,uuid,uuid,integer,text,integer)'::regprocedure,
    'public.mark_immediate_broadcast_delivery_send_started(uuid,uuid,integer,uuid,uuid,text)'::regprocedure,
    'public.renew_immediate_broadcast_request_lease(uuid,integer,uuid,uuid,text,integer)'::regprocedure,
    'public.complete_immediate_broadcast_delivery(uuid,uuid,integer,uuid,uuid,text,text,text,jsonb,text)'::regprocedure,
    'public.get_immediate_broadcast_request_summary(uuid,integer,uuid)'::regprocedure,
    'public.recover_immediate_broadcast_request(uuid,integer,uuid,uuid,text,integer,integer)'::regprocedure
  ] loop
    if exists (
      select 1 from pg_catalog.pg_proc as proc_row
      cross join lateral pg_catalog.aclexplode(coalesce(proc_row.proacl, pg_catalog.acldefault('f', proc_row.proowner))) as privilege
      where proc_row.oid=v_function and privilege.grantee=0 and privilege.privilege_type='EXECUTE'
    ) then raise exception using errcode='42501', message='PUBLIC has immediate broadcast RPC execute'; end if;
    foreach v_role in array array['anon','authenticated'] loop
      if has_function_privilege(v_role,v_function,'EXECUTE') then
        raise exception using errcode='42501', message='browser role has immediate broadcast RPC execute';
      end if;
    end loop;
  end loop;
end $$;
