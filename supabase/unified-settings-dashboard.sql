-- Unified Settings + Dashboard operational patch.
-- Apply through the normal Supabase deployment process; this file is not run by the app.

begin;

-- Browser clients may read their own organization through the existing owner SELECT
-- policies, but all writes must go through guarded server routes using service_role.
revoke all privileges on table public.organization from anon;
revoke all privileges on table public.organization from authenticated;
grant select on table public.organization to authenticated;

revoke all privileges on sequence public.organization_id_seq from anon;
revoke all privileges on sequence public.organization_id_seq from authenticated;

drop policy if exists "owners can update" on public.organization;

alter table public.organization
  alter column logo_url set default '/images/Logos/Logo cores.png';

update public.organization
set logo_url = '/images/Logos/Logo cores.png'
where logo_url is null or logo_url = '/images/digik.png';

-- Supports the dashboard's distinct channel-user lookup. The schema snapshot has
-- user/thread indexes but no organization/channel/role index for this query.
create index if not exists message_org_channel_role_user_idx
  on public.message (organization_id, channel, role, user_id)
  where user_id is not null;

commit;
