-- SEC-02: close direct Data API mutation paths and enforce tenant invariants.
-- This migration is intentionally fail-closed: it does not clean production data.

begin;

-- Phase 1: keep the preflight and constraint installation free from write races.
lock table public.organization in share row exclusive mode;
lock table public.assistant in share row exclusive mode;
lock table public."user" in share row exclusive mode;

-- PostgreSQL 15 introduced a column list for ON DELETE SET NULL. Older
-- versions use the compatible trigger branch installed in Phase 3.
do $$
declare
  v_server_version_num integer := current_setting('server_version_num')::integer;
begin
  if v_server_version_num < 150000 then
    raise notice
      'SEC-02: PostgreSQL % uses the compatible assistant delete trigger',
      current_setting('server_version');
  end if;
end
$$;

-- Phase 2: abort with aggregate-only diagnostics if remediation is required.
do $$
declare
  v_count bigint;
begin
  select count(*)
  into v_count
  from (
    select o.channel_id
    from public.organization as o
    group by o.channel_id
    having count(*) > 1
  ) as duplicates;

  if v_count > 0 then
    raise exception using
      errcode = '23505',
      message = format(
        'SEC-02 preflight failed: %s duplicate channel_id group(s) require cleanup',
        v_count
      );
  end if;

  select count(*)
  into v_count
  from public.organization as o
  where btrim(o.channel_id) = '';

  if v_count > 0 then
    raise exception using
      errcode = '23514',
      message = format(
        'SEC-02 preflight failed: %s blank channel_id row(s) require cleanup',
        v_count
      );
  end if;

  select count(*)
  into v_count
  from (
    select o.teams_tenant_id
    from public.organization as o
    where o.teams_tenant_id is not null
    group by o.teams_tenant_id
    having count(*) > 1
  ) as duplicates;

  if v_count > 0 then
    raise exception using
      errcode = '23505',
      message = format(
        'SEC-02 preflight failed: %s duplicate teams_tenant_id group(s) require cleanup',
        v_count
      );
  end if;

  select count(*)
  into v_count
  from public.organization as o
  where o.teams_tenant_id is not null
    and btrim(o.teams_tenant_id) = '';

  if v_count > 0 then
    raise exception using
      errcode = '23514',
      message = format(
        'SEC-02 preflight failed: %s blank teams_tenant_id row(s) require cleanup',
        v_count
      );
  end if;

  select count(*)
  into v_count
  from public."user" as u
  join public.assistant as a on a.id = u.assistant_id
  where a.organization_id <> u.organization_id;

  if v_count > 0 then
    raise exception using
      errcode = '23503',
      message = format(
        'SEC-02 preflight failed: %s cross-tenant user/assistant relation(s) require cleanup',
        v_count
      );
  end if;
end
$$;

-- Phase 3: enforce external identifier uniqueness and same-tenant assistants.
alter table public.organization
  add constraint organization_channel_id_not_blank
  check (btrim(channel_id) <> ''),
  add constraint organization_channel_id_key
  unique (channel_id),
  add constraint organization_teams_tenant_id_not_blank
  check (teams_tenant_id is null or btrim(teams_tenant_id) <> '');

-- Evaluate the UNIQUE definition in pg_constraint, not only its name. If the
-- expected name is occupied by an incompatible constraint, use a dedicated
-- SEC-02 name. The duplicate preflight above makes this addition fail-closed.
do $$
declare
  v_attnum smallint;
  v_has_exact_unique boolean;
  v_constraint_name text;
begin
  select a.attnum
  into v_attnum
  from pg_catalog.pg_attribute as a
  where a.attrelid = 'public.organization'::regclass
    and a.attname = 'teams_tenant_id'
    and not a.attisdropped;

  if v_attnum is null then
    raise exception using
      errcode = '42703',
      message = 'SEC-02 preflight failed: organization.teams_tenant_id is missing';
  end if;

  select exists (
    select 1
    from pg_catalog.pg_constraint as c
    where c.conrelid = 'public.organization'::regclass
      and c.contype = 'u'
      and c.conkey = array[v_attnum]::smallint[]
  )
  into v_has_exact_unique;

  if not v_has_exact_unique then
    if exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conrelid = 'public.organization'::regclass
        and c.conname = 'organization_teams_tenant_id_key'
    ) then
      v_constraint_name := 'organization_teams_tenant_id_unique_sec02';
    else
      v_constraint_name := 'organization_teams_tenant_id_key';
    end if;

    if exists (
      select 1
      from pg_catalog.pg_constraint as c
      where c.conrelid = 'public.organization'::regclass
        and c.conname = v_constraint_name
    ) then
      raise exception using
        errcode = '42710',
        message = format(
          'SEC-02 preflight failed: constraint name %s is occupied but no exact teams_tenant_id UNIQUE exists',
          v_constraint_name
        );
    end if;

    execute format(
      'alter table public.organization add constraint %I unique (teams_tenant_id)',
      v_constraint_name
    );
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as c
    where c.conrelid = 'public.organization'::regclass
      and c.contype = 'u'
      and c.conkey = array[v_attnum]::smallint[]
  ) then
    raise exception using
      errcode = '23505',
      message = 'SEC-02 failed to enforce exact UNIQUE on organization.teams_tenant_id';
  end if;
end
$$;

alter table public.assistant
  add constraint assistant_id_organization_id_key
  unique (id, organization_id);

alter table public."user"
  drop constraint user_assistant_id_fkey;

do $$
declare
  v_server_version_num integer := current_setting('server_version_num')::integer;
begin
  if v_server_version_num >= 150000 then
    execute $ddl$
      alter table public."user"
        add constraint user_assistant_organization_fkey
        foreign key (assistant_id, organization_id)
        references public.assistant (id, organization_id)
        on delete set null (assistant_id)
    $ddl$;
  else
    execute $function$
      create function public.sec02_clear_user_assistant_before_delete()
      returns trigger
      language plpgsql
      security invoker
      set search_path = ''
      as $body$
      begin
        update public."user"
        set assistant_id = null
        where assistant_id = old.id
          and organization_id = old.organization_id;
        return old;
      end;
      $body$
    $function$;

    execute $ddl$
      alter table public."user"
        add constraint user_assistant_organization_fkey
        foreign key (assistant_id, organization_id)
        references public.assistant (id, organization_id)
        on delete no action
    $ddl$;

    execute $ddl$
      create trigger sec02_clear_user_assistant_before_delete
      before delete on public.assistant
      for each row
      execute function public.sec02_clear_user_assistant_before_delete()
    $ddl$;

    revoke all privileges on function
      public.sec02_clear_user_assistant_before_delete()
      from public, anon, authenticated;
    grant execute on function
      public.sec02_clear_user_assistant_before_delete()
      to service_role;
  end if;
end
$$;

-- Phase 4: harden the only supported user-creation path.
create or replace function public.create_user_with_plan_limit(
  p_organization_id integer,
  p_phone_number text default null::text,
  p_name text default null::text,
  p_assistant_id integer default null::integer,
  p_email text default null::text,
  p_teams_aad_object_id text default null::text,
  p_teams_from_id text default null::text,
  p_phone_country_code text default null::text,
  p_phone_national text default null::text
)
returns setof public."user"
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan_id integer;
  v_max_users_override integer;
  v_plan_max_users integer;
  v_effective_max_users integer;
  v_user_count integer;
begin
  if current_user <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'create_user_with_plan_limit is restricted to service_role';
  end if;

  select o.plan_id, o.max_users_override
  into v_plan_id, v_max_users_override
  from public.organization as o
  where o.id = p_organization_id
  for update of o;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = format('Organization %s not found', p_organization_id);
  end if;

  if p_assistant_id is not null and not exists (
    select 1
    from public.assistant as a
    where a.id = p_assistant_id
      and a.organization_id = p_organization_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'Assistant does not belong to the target organization';
  end if;

  select p.max_users
  into v_plan_max_users
  from public.plan as p
  where p.id = v_plan_id;

  v_effective_max_users := coalesce(
    v_max_users_override,
    v_plan_max_users
  );

  select count(*)::integer
  into v_user_count
  from public."user" as u
  where u.organization_id = p_organization_id;

  if v_effective_max_users is not null
     and v_user_count >= v_effective_max_users then
    raise exception using
      errcode = 'P0001',
      message = format(
        'User limit reached for organization %s',
        p_organization_id
      );
  end if;

  return query
  insert into public."user" (
    organization_id,
    phone_number,
    name,
    assistant_id,
    email,
    teams_aad_object_id,
    teams_from_id,
    phone_country_code,
    phone_national
  )
  values (
    p_organization_id,
    p_phone_number,
    p_name,
    p_assistant_id,
    p_email,
    p_teams_aad_object_id,
    p_teams_from_id,
    p_phone_country_code,
    p_phone_national
  )
  returning *;
end;
$$;

-- Phase 5: authenticated clients may read under RLS but cannot mutate directly.
revoke all privileges on table public.organization
  from public, anon, authenticated;
revoke all privileges on table public."user"
  from public, anon, authenticated;

-- Table-level REVOKE does not remove independent column ACLs. Discover every
-- live user column and remove every PostgreSQL column privilege directly
-- granted to PUBLIC or a browser role before restoring authenticated SELECT.
do $$
declare
  v_column record;
begin
  for v_column in
    select
      attribute.attname as column_name,
      format('%I.%I', namespace.nspname, relation.relname) as table_name
    from pg_catalog.pg_attribute as attribute
    join pg_catalog.pg_class as relation
      on relation.oid = attribute.attrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where attribute.attrelid in (
      'public.organization'::regclass,
      'public."user"'::regclass
    )
      and attribute.attnum > 0
      and not attribute.attisdropped
  loop
    execute format(
      'revoke select (%1$I), insert (%1$I), update (%1$I), references (%1$I) on table %2$s from public, anon, authenticated',
      v_column.column_name,
      v_column.table_name
    );
  end loop;
end
$$;

grant select on table public.organization to authenticated;
grant select on table public."user" to authenticated;

-- SECURITY INVOKER requires these privileges for SELECT FOR UPDATE, reads,
-- INSERT and RETURNING. Existing broader service_role grants are preserved for
-- other server repositories, while the RPC's minimum is explicit here.
grant select, update on table public.organization to service_role;
grant select on table public.assistant to service_role;
grant select on table public.plan to service_role;
grant select, insert, update, delete on table public."user" to service_role;

-- Discover every sequence owned by/identified with organization.id or user.id.
-- This handles serial/identity drift without assuming exported sequence names.
do $$
declare
  v_sequence record;
  v_org_sequence text;
  v_user_sequence text;
  v_org_found boolean := false;
  v_user_found boolean := false;
begin
  v_org_sequence := pg_catalog.pg_get_serial_sequence(
    'public.organization',
    'id'
  );
  v_user_sequence := pg_catalog.pg_get_serial_sequence(
    'public."user"',
    'id'
  );

  if v_org_sequence is null then
    raise exception using
      errcode = '55000',
      message = 'SEC-02 preflight failed: organization.id has no associated sequence';
  end if;

  if v_user_sequence is null then
    raise exception using
      errcode = '55000',
      message = 'SEC-02 preflight failed: user.id has no associated sequence';
  end if;

  for v_sequence in
    select
      format(
        '%I.%I',
        sequence_namespace.nspname,
        sequence_class.relname
      ) as qualified_name,
      dependency.refobjid as table_oid
    from pg_catalog.pg_depend as dependency
    join pg_catalog.pg_class as sequence_class
      on sequence_class.oid = dependency.objid
    join pg_catalog.pg_namespace as sequence_namespace
      on sequence_namespace.oid = sequence_class.relnamespace
    where dependency.classid = 'pg_catalog.pg_class'::regclass
      and dependency.refclassid = 'pg_catalog.pg_class'::regclass
      and dependency.refobjid in (
        'public.organization'::regclass,
        'public."user"'::regclass
      )
      and dependency.refobjsubid in (
        select attribute.attnum
        from pg_catalog.pg_attribute as attribute
        where attribute.attrelid = dependency.refobjid
          and attribute.attname = 'id'
          and not attribute.attisdropped
      )
      and dependency.deptype in ('a', 'i')
      and sequence_class.relkind = 'S'
  loop
    execute format(
      'revoke all privileges on sequence %s from public, anon, authenticated',
      v_sequence.qualified_name
    );
    execute format(
      'grant usage on sequence %s to service_role',
      v_sequence.qualified_name
    );

    if v_sequence.table_oid = 'public.organization'::regclass then
      v_org_found := true;
    elsif v_sequence.table_oid = 'public."user"'::regclass then
      v_user_found := true;
    end if;

    if pg_catalog.has_sequence_privilege(
      'anon',
      v_sequence.qualified_name,
      'USAGE'
    ) or pg_catalog.has_sequence_privilege(
      'anon',
      v_sequence.qualified_name,
      'SELECT'
    ) or pg_catalog.has_sequence_privilege(
      'anon',
      v_sequence.qualified_name,
      'UPDATE'
    ) or pg_catalog.has_sequence_privilege(
      'authenticated',
      v_sequence.qualified_name,
      'USAGE'
    ) or pg_catalog.has_sequence_privilege(
      'authenticated',
      v_sequence.qualified_name,
      'SELECT'
    ) or pg_catalog.has_sequence_privilege(
      'authenticated',
      v_sequence.qualified_name,
      'UPDATE'
    ) then
      raise exception using
        errcode = '42501',
        message = format(
          'SEC-02 preflight failed: browser role inherits sequence privilege on %s',
          v_sequence.qualified_name
        );
    end if;
  end loop;

  if not v_org_found or not v_user_found then
    raise exception using
      errcode = '55000',
      message = 'SEC-02 preflight failed: indispensable id sequence dependency is missing';
  end if;
end
$$;

revoke all privileges on function public.create_user_with_plan_limit(
  integer,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.create_user_with_plan_limit(
  integer,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text
) to service_role;

-- Validate effective privileges, including inherited table/column ACLs. The
-- only browser privilege permitted at the end is authenticated table SELECT,
-- which remains subject to RLS.
do $$
declare
  v_table record;
  v_column record;
begin
  for v_table in
    select
      relation.oid as table_oid,
      format('%I.%I', namespace.nspname, relation.relname) as table_name
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where relation.oid in (
      'public.organization'::regclass,
      'public."user"'::regclass
    )
  loop
    if pg_catalog.has_table_privilege('anon', v_table.table_oid, 'SELECT')
      or pg_catalog.has_table_privilege('anon', v_table.table_oid, 'INSERT')
      or pg_catalog.has_table_privilege('anon', v_table.table_oid, 'UPDATE')
      or pg_catalog.has_table_privilege('anon', v_table.table_oid, 'DELETE')
      or pg_catalog.has_table_privilege('anon', v_table.table_oid, 'TRUNCATE')
      or pg_catalog.has_table_privilege('anon', v_table.table_oid, 'REFERENCES')
      or pg_catalog.has_table_privilege('anon', v_table.table_oid, 'TRIGGER')
    then
      raise exception using
        errcode = '42501',
        message = format(
          'SEC-02 preflight failed: anon inherits table privilege on %s',
          v_table.table_name
        );
    end if;

    if pg_catalog.has_table_privilege(
      'authenticated', v_table.table_oid, 'INSERT'
    ) or pg_catalog.has_table_privilege(
      'authenticated', v_table.table_oid, 'UPDATE'
    ) or pg_catalog.has_table_privilege(
      'authenticated', v_table.table_oid, 'DELETE'
    ) or pg_catalog.has_table_privilege(
      'authenticated', v_table.table_oid, 'TRUNCATE'
    ) or pg_catalog.has_table_privilege(
      'authenticated', v_table.table_oid, 'REFERENCES'
    ) or pg_catalog.has_table_privilege(
      'authenticated', v_table.table_oid, 'TRIGGER'
    ) then
      raise exception using
        errcode = '42501',
        message = format(
          'SEC-02 preflight failed: authenticated inherits forbidden table privilege on %s',
          v_table.table_name
        );
    end if;

    if not pg_catalog.has_table_privilege(
      'authenticated', v_table.table_oid, 'SELECT'
    ) then
      raise exception using
        errcode = '42501',
        message = format(
          'SEC-02 preflight failed: authenticated SELECT is missing on %s',
          v_table.table_name
        );
    end if;
  end loop;

  for v_column in
    select
      attribute.attrelid as table_oid,
      attribute.attnum as column_number,
      format(
        '%I.%I.%I',
        namespace.nspname,
        relation.relname,
        attribute.attname
      ) as column_name
    from pg_catalog.pg_attribute as attribute
    join pg_catalog.pg_class as relation
      on relation.oid = attribute.attrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where attribute.attrelid in (
      'public.organization'::regclass,
      'public."user"'::regclass
    )
      and attribute.attnum > 0
      and not attribute.attisdropped
  loop
    if pg_catalog.has_column_privilege(
      'anon', v_column.table_oid, v_column.column_number, 'SELECT'
    ) or pg_catalog.has_column_privilege(
      'anon', v_column.table_oid, v_column.column_number, 'INSERT'
    ) or pg_catalog.has_column_privilege(
      'anon', v_column.table_oid, v_column.column_number, 'UPDATE'
    ) or pg_catalog.has_column_privilege(
      'anon', v_column.table_oid, v_column.column_number, 'REFERENCES'
    ) then
      raise exception using
        errcode = '42501',
        message = format(
          'SEC-02 preflight failed: anon inherits column privilege on %s',
          v_column.column_name
        );
    end if;

    if pg_catalog.has_column_privilege(
      'authenticated', v_column.table_oid, v_column.column_number, 'INSERT'
    ) or pg_catalog.has_column_privilege(
      'authenticated', v_column.table_oid, v_column.column_number, 'UPDATE'
    ) or pg_catalog.has_column_privilege(
      'authenticated', v_column.table_oid, v_column.column_number, 'REFERENCES'
    ) then
      raise exception using
        errcode = '42501',
        message = format(
          'SEC-02 preflight failed: authenticated inherits forbidden column privilege on %s',
          v_column.column_name
        );
    end if;

    if not pg_catalog.has_column_privilege(
      'authenticated', v_column.table_oid, v_column.column_number, 'SELECT'
    ) then
      raise exception using
        errcode = '42501',
        message = format(
          'SEC-02 preflight failed: authenticated column SELECT is missing on %s',
          v_column.column_name
        );
    end if;
  end loop;

  if not pg_catalog.has_table_privilege(
    'service_role', 'public."user"', 'SELECT'
  ) or not pg_catalog.has_table_privilege(
    'service_role', 'public."user"', 'INSERT'
  ) or not pg_catalog.has_table_privilege(
    'service_role', 'public."user"', 'UPDATE'
  ) or not pg_catalog.has_table_privilege(
    'service_role', 'public."user"', 'DELETE'
  ) then
    raise exception using
      errcode = '42501',
      message = 'SEC-02 preflight failed: service_role lacks required user table privileges';
  end if;

  if pg_catalog.has_function_privilege(
    'anon',
    'public.create_user_with_plan_limit(integer,text,text,integer,text,text,text,text,text)',
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_user_with_plan_limit(integer,text,text,integer,text,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception using
      errcode = '42501',
      message = 'SEC-02 preflight failed: browser role inherits RPC EXECUTE';
  end if;
end
$$;

-- Phase 6: remove obsolete mutation policies; SELECT policies remain intact.
drop policy if exists "owners can update" on public.organization;
drop policy if exists "owner can insert users" on public."user";
drop policy if exists "owner can update users" on public."user";
drop policy if exists "owner can delete users" on public."user";

commit;
