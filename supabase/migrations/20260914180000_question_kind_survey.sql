-- Sondagem: novo tipo de pergunta (issue #107)
--
-- A tabela question limitava kind a quiz e pergunta aberta. A sondagem é uma
-- pergunta com botões sem resposta certa; is_correct fica nulo e o
-- agradecimento após a escolha fica em feedback_correct.
--
-- Executar no SQL Editor do Supabase antes de deployar o código que a usa.

alter table public.question
  drop constraint if exists question_kind_check;

alter table public.question
  add constraint question_kind_check
  check (kind in ('quiz', 'survey', 'open'));

comment on column public.question.kind is
  'quiz (botões, com resposta certa), survey (botões, sem resposta certa) ou open (resposta livre avaliada pela IA).';
