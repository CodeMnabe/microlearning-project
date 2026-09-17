-- Vários assistentes por utilizador (issues #131, #132)
--
-- user_assistant guarda os assistentes atribuídos a cada utilizador.
-- user.assistant_id mantém-se e passa a ser o assistente ativo: o que
-- responde às mensagens. O ativo está sempre entre os atribuídos; o trigger
-- garante-o em todos os caminhos que escrevem user.assistant_id (criação
-- pela função create_user_with_plan_limit, importação, ações em massa).
--
-- Executar no SQL Editor do Supabase.

create table if not exists public.user_assistant (
  user_id      integer not null references public."user" (id) on delete cascade,
  assistant_id integer not null references public.assistant (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, assistant_id)
);

create index if not exists user_assistant_assistant_id_idx
  on public.user_assistant (assistant_id);

comment on table public.user_assistant is
  'Assistentes atribuídos a cada utilizador. O ativo é user.assistant_id.';

-- Só o servidor (service role) acede; sem políticas, como nas outras tabelas.
alter table public.user_assistant enable row level security;

create or replace function public.sync_user_active_assistant()
returns trigger
language plpgsql
as $$
begin
  if new.assistant_id is not null then
    insert into public.user_assistant (user_id, assistant_id)
    values (new.id, new.assistant_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists user_sync_active_assistant on public."user";
create trigger user_sync_active_assistant
  after insert or update of assistant_id on public."user"
  for each row execute function public.sync_user_active_assistant();

-- Os utilizadores existentes ficam com o assistente que já têm.
insert into public.user_assistant (user_id, assistant_id)
select u.id, u.assistant_id
from public."user" u
where u.assistant_id is not null
on conflict do nothing;

-- Troca de assistente na conversa (#132): último menu enviado ao contacto.
-- Um toque num botão liga-se ao menu pelo id da mensagem; um número ou nome
-- escrito à mão só conta nos minutos a seguir ao envio.
alter table public."user"
  add column if not exists assistant_menu_message_id text,
  add column if not exists assistant_menu_sent_at timestamptz;
