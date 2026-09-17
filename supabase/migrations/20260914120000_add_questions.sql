-- Perguntas WhatsApp: quiz e pergunta aberta (issues #103, #102)
--
-- Uma linha em question por envio. Cada mensagem entregue com a pergunta
-- fica ligada por message.question_id, e um toque num botão chega com a
-- referência à mensagem enviada, por isso é por aí que se encontra a
-- pergunta certa. Só a primeira resposta de cada contacto conta.
--
-- Executar no SQL Editor do Supabase.

create table if not exists public.question (
  id                     bigserial primary key,
  organization_id        integer not null references public.organization (id) on delete cascade,
  kind                   text not null check (kind in ('quiz', 'open')),
  body                   text not null,
  -- quiz: [{ "label": "2,2 bar", "correct": false }, ...] pela ordem dos botões
  options                jsonb,
  feedback_correct       text,
  feedback_incorrect     text,
  -- pergunta aberta (#102)
  expected_answer        text,
  scheduled_broadcast_id uuid,
  send_group_id          uuid,
  created_by_user_id     uuid,
  expires_at             timestamptz not null,
  created_at             timestamptz not null default now()
);

create index if not exists question_organization_id_idx
  on public.question (organization_id, created_at desc);

comment on table public.question is
  'Quiz ou pergunta aberta enviada por WhatsApp. options guarda as opções do quiz pela ordem dos botões.';

alter table public.message
  add column if not exists question_id bigint references public.question (id) on delete set null;

create index if not exists message_question_id_idx
  on public.message (question_id);

comment on column public.message.question_id is
  'Pergunta entregue nesta mensagem. Um toque num botão referencia esta mensagem pelo message_id.';

create table if not exists public.question_answer (
  id                 bigserial primary key,
  question_id        bigint not null references public.question (id) on delete cascade,
  organization_id    integer not null references public.organization (id) on delete cascade,
  user_id            integer not null references public."user" (id) on delete cascade,
  -- mensagem nossa que foi respondida
  message_id         integer references public.message (id) on delete set null,
  -- id Bird da resposta recebida
  inbound_message_id uuid,
  answer_text        text,
  -- quiz: índice da opção escolhida (base 0) e se estava certa
  option_index       integer,
  is_correct         boolean,
  -- pergunta aberta (#102)
  verdict            text check (verdict is null or verdict in ('completa', 'parcial', 'incompleta')),
  ai_feedback        text,
  admin_verdict      text check (admin_verdict is null or admin_verdict in ('completa', 'parcial', 'incompleta')),
  review_needed      boolean not null default false,
  answered_at        timestamptz not null default now(),
  unique (question_id, user_id)
);

create index if not exists question_answer_user_id_idx
  on public.question_answer (user_id, answered_at desc);

comment on table public.question_answer is
  'Primeira resposta de cada contacto a uma pergunta. Respostas seguintes à mesma pergunta são ignoradas.';

-- O servidor acede com a chave de serviço, que ignora o RLS. Ativá-lo sem
-- políticas impede leituras pela chave pública do browser.
alter table public.question enable row level security;
alter table public.question_answer enable row level security;
