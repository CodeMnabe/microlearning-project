create table if not exists public.auth_attempt_bucket (
  action text not null,
  identity_type text not null,
  identity_hash text not null,
  window_started_at timestamptz not null default pg_catalog.clock_timestamp(),
  attempt_count integer not null default 0,
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (action, identity_type, identity_hash),
  constraint auth_attempt_bucket_action_check
    check (action in ('login', 'reset')),
  constraint auth_attempt_bucket_identity_type_check
    check (identity_type in ('email', 'ip')),
  constraint auth_attempt_bucket_identity_hash_check
    check (identity_hash ~ '^[0-9a-f]{64}$'),
  constraint auth_attempt_bucket_count_check
    check (attempt_count between 0 and 1000000)
);

alter table public.auth_attempt_bucket enable row level security;

revoke all on table public.auth_attempt_bucket from public, anon, authenticated;
grant select, insert, update on table public.auth_attempt_bucket to service_role;

create or replace function public.consume_auth_attempt(
  p_action text,
  p_email_hash text,
  p_ip_hash text
)
returns boolean
language plpgsql
security invoker
volatile
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_allowed boolean;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'auth rate limit is restricted to service_role';
  end if;

  if p_action not in ('login', 'reset')
     or p_email_hash !~ '^[0-9a-f]{64}$'
     or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid auth rate limit parameters';
  end if;

  with consumed as (
    insert into public.auth_attempt_bucket as bucket (
      action,
      identity_type,
      identity_hash,
      window_started_at,
      attempt_count,
      updated_at
    ) values
      (p_action, 'email', p_email_hash, v_now, 1, v_now),
      (p_action, 'ip', p_ip_hash, v_now, 1, v_now)
    on conflict (action, identity_type, identity_hash) do update
    set
      window_started_at = case
        when bucket.window_started_at <= v_now - interval '15 minutes' then v_now
        else bucket.window_started_at
      end,
      attempt_count = case
        when bucket.window_started_at <= v_now - interval '15 minutes' then 1
        else pg_catalog.least(bucket.attempt_count + 1, 1000000)
      end,
      updated_at = v_now
    returning identity_type, attempt_count
  )
  -- 5 por email; 20 por IP, que pode ser partilhado por um escritório.
  select pg_catalog.bool_and(
    attempt_count <= case identity_type when 'ip' then 20 else 5 end
  )
  into v_allowed
  from consumed;

  return coalesce(v_allowed, false);
end;
$$;

revoke all on function public.consume_auth_attempt(text, text, text)
  from public, anon, authenticated;
grant execute on function public.consume_auth_attempt(text, text, text)
  to service_role;
