-- Histórico de atividade (issue #76)
--
-- Uma linha por ação feita na plataforma: quem, quando, o quê e sobre que
-- elemento. Escrita apenas pelo servidor (service role). Leitura pelo owner
-- da organização, através da API ou diretamente com a sessão autenticada.
--
-- Executar no SQL Editor do Supabase. Não altera nenhuma tabela existente.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id integer not null
    references public.organization (id) on delete cascade,
  actor_type text not null default 'user'
    check (actor_type in ('user', 'system')),
  actor_user_id uuid,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  entity_label text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_log is
  'Cronologia das ações feitas em cada organização.';
comment on column public.audit_log.actor_type is
  'user: feita por um utilizador autenticado; system: feita pela plataforma (cron, webhooks).';
comment on column public.audit_log.action is
  'Identificador da ação no formato entidade.verbo, por exemplo user.created.';
comment on column public.audit_log.entity_type is
  'Tipo do elemento afetado, por exemplo user, tag, assistant.';
comment on column public.audit_log.entity_id is
  'Id do elemento afetado, guardado como texto porque há ids inteiros e uuid.';
comment on column public.audit_log.entity_label is
  'Nome legível do elemento no momento da ação, para o histórico continuar a fazer sentido depois de ele ser apagado.';

create index if not exists idx_audit_log_org_created
  on public.audit_log (organization_id, created_at desc);

create index if not exists idx_audit_log_org_action
  on public.audit_log (organization_id, action);

alter table public.audit_log enable row level security;

-- Só o owner da organização pode ler o histórico dela.
-- Não há política de escrita: as inserções são feitas pelo servidor
-- com a service role, que ignora RLS.
drop policy if exists "owner can read audit log" on public.audit_log;

create policy "owner can read audit log"
  on public.audit_log
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization o
      where o.id = audit_log.organization_id
        and o.owner_user_id = auth.uid()
    )
  );

grant select on table public.audit_log to authenticated;
grant select, insert on table public.audit_log to service_role;
