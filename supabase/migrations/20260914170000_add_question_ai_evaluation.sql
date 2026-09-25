-- Preferência de avaliação pela IA na pergunta aberta (issue #102)
--
-- Passa a ter coluna própria. Até aqui vivia dentro de question.options,
-- que no quiz é a lista de opções, o que obrigava a lidar com dois formatos.
--
-- Executar no SQL Editor do Supabase antes de deployar o código que a usa.

alter table public.question
  add column if not exists ai_evaluation boolean not null default true;

comment on column public.question.ai_evaluation is
  'Pergunta aberta: se a resposta do contacto é avaliada pela IA antes de enviar a resposta esperada.';

-- Migra as perguntas abertas já criadas e limpa o campo options.
update public.question
set
  ai_evaluation = coalesce((options ->> 'aiEvaluation')::boolean, true),
  options = null
where kind = 'open'
  and jsonb_typeof(options) = 'object';
