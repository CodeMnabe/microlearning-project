import {
  normalizeOpenQuestion,
  normalizeQuiz,
  normalizeSurvey,
} from "@/lib/whatsapp/question";

/**
 * Lê a pergunta vinda do cliente ou de um payload agendado.
 *
 * Devolve `{ question: null }` quando o envio não tem pergunta e
 * `{ error }` quando a pergunta não é válida.
 */
export function parseQuestionOptions(body = {}) {
  const raw = body?.question;

  if (raw == null) {
    return { question: null };
  }

  if (typeof raw !== "object") {
    return { error: "question must be an object" };
  }

  if (raw.kind === "quiz") {
    const result = normalizeQuiz(raw);

    if (result.error) return { error: result.error };

    return { question: result.quiz };
  }

  if (raw.kind === "survey") {
    const result = normalizeSurvey(raw);

    if (result.error) return { error: result.error };

    return { question: result.survey };
  }

  if (raw.kind === "open") return normalizeOpenQuestion(raw);

  return { error: "Unsupported question kind" };
}
