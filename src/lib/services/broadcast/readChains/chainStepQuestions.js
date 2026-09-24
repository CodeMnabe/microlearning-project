import { createQuestion } from "@/lib/repos/questions.repo";
import { parseQuestionOptions } from "@/lib/services/broadcast/questionOptions";
import { QUESTION_VALIDITY_DAYS } from "@/lib/whatsapp/question";

/*
 * Numa cadeia, um passo pode ser entregue dias depois da criação (atrasos e
 * leituras). A pergunta aceita respostas 7 dias depois de cada entrega, mas a
 * linha em `question` precisa de um limite exterior: a data de arranque mais
 * os atrasos acumulados até ao passo, com uma margem para as leituras.
 */
export const CHAIN_QUESTION_MARGIN_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Valida a pergunta de cada passo. Devolve `{ error }` com o número do passo
 * quando alguma não é válida.
 */
export function parseChainStepQuestions(steps) {
  const questions = [];

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const parsed = parseQuestionOptions({ question: step?.question ?? null });

    if (parsed.error) {
      return { error: `Message ${index + 1}: ${parsed.error}` };
    }

    questions.push(parsed.question);
  }

  return { questions };
}

export function chainStepExpiryDate({ startAt, cumulativeDelayMinutes = 0 }) {
  const base = startAt ? new Date(startAt).getTime() : Date.now();

  return new Date(
    base +
      cumulativeDelayMinutes * 60 * 1000 +
      (QUESTION_VALIDITY_DAYS + CHAIN_QUESTION_MARGIN_DAYS) * DAY_MS,
  );
}

/**
 * Cria uma linha em `question` por passo com pergunta e devolve os passos
 * com `questionId`, prontos a guardar. A pergunta é partilhada por todos os
 * destinatários da cadeia, por isso é criada uma vez, aqui, e não em cada
 * envio.
 */
export async function attachChainStepQuestions({
  steps,
  questions,
  organizationId,
  createdByUserId = null,
  startAt = null,
  deps = {},
}) {
  const create = deps.createQuestion || createQuestion;
  const result = [];
  let cumulativeDelayMinutes = 0;

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const question = questions[index] || null;

    cumulativeDelayMinutes += Number(step.delayAfterPreviousReadMinutes || 0);

    if (!question) {
      result.push({ ...step, question: null, questionId: null });
      continue;
    }

    const isQuiz = question.kind === "quiz";
    const isSurvey = question.kind === "survey";
    const withButtons = isQuiz || isSurvey;

    const row = await create({
      organizationId,
      kind: question.kind,
      body: question.body,
      options: withButtons ? question.options : null,
      feedbackCorrect: isQuiz
        ? question.feedbackCorrect
        : isSurvey
          ? question.thanksText || null
          : null,
      feedbackIncorrect: isQuiz ? question.feedbackIncorrect : null,
      expectedAnswer: withButtons ? null : question.expectedAnswer,
      aiEvaluation: withButtons ? true : question.aiEvaluation !== false,
      createdByUserId,
      expiresAt: chainStepExpiryDate({ startAt, cumulativeDelayMinutes }),
    });

    result.push({
      ...step,
      /*
       * A pergunta é a própria mensagem do passo; os anexos e os links do
       * passo seguem com ela (o anexo numa mensagem antes da pergunta).
       */
      message: question.body,
      question,
      questionId: row.id,
    });
  }

  return result;
}
