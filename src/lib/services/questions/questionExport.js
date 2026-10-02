import { buildQuestionReports, effectiveVerdict } from "./questionReports";

/**
 * Linhas da exportação para Excel da página das Perguntas (#105).
 *
 * Função pura, como os relatórios: recebe as linhas já lidas e devolve
 * uma linha por pergunta e uma por resposta. Os totais vêm dos mesmos
 * relatórios que a página mostra, para os números baterem certo.
 *
 * As respostas não guardam o canal nem o assistente: vêm da mensagem que
 * levou a pergunta àquele colaborador. Com as etiquetas e o assistente
 * em cada linha, os resumos por tag ou por assistente fazem-se no Excel.
 *
 * - `users`: mapa `id -> user`, com `tags` já em texto.
 * - `assistantNames`: mapa `id -> nome`.
 */
export function buildQuestionExport({
  questions = [],
  messages = [],
  answers = [],
  users = new Map(),
  assistantNames = new Map(),
}) {
  const reports = buildQuestionReports({ questions, messages, answers });
  const questionsById = new Map(reports.map((item) => [String(item.id), item]));

  const channelsByQuestion = new Map();
  const sendByQuestionUser = new Map();

  for (const message of messages) {
    const key = String(message.question_id);
    if (!channelsByQuestion.has(key)) channelsByQuestion.set(key, new Set());
    if (message.channel) channelsByQuestion.get(key).add(message.channel);

    sendByQuestionUser.set(`${key}:${message.user_id}`, message);
  }

  const optionLabel = (item, index) =>
    typeof index === "number" ? item?.options?.[index]?.label || null : null;

  const questionRows = reports.map((item) => {
    const correctIndex = item.options.findIndex((option) => option?.correct);
    const counts = item.optionCounts || [];
    const top = Math.max(0, ...counts);
    const topIndex = top > 0 ? counts.indexOf(top) : -1;

    return {
      id: item.id,
      sentAt: item.sentAt,
      kind: item.kind,
      question: item.body,
      channels: [...(channelsByQuestion.get(String(item.id)) || [])].join(", "),
      recipients: item.recipientCount,
      answered: item.answeredCount,
      // Frações: a folha mostra-as como percentagem.
      responseRate: item.recipientCount
        ? item.answeredCount / item.recipientCount
        : null,
      correctRate:
        item.kind === "quiz" && item.answeredCount
          ? item.correctCount / item.answeredCount
          : null,
      correctOption:
        item.kind === "quiz" && correctIndex >= 0
          ? optionLabel(item, correctIndex)
          : null,
      topOption: topIndex >= 0 ? `${optionLabel(item, topIndex)} (${top})` : null,
      expectedAnswer: item.expectedAnswer,
      reviewNeeded: item.reviewNeededCount,
      expiresAt: item.expiresAt,
    };
  });

  const answerRows = [...answers]
    .sort((a, b) => String(a.answered_at).localeCompare(String(b.answered_at)))
    .map((answer) => {
      const item = questionsById.get(String(answer.question_id));
      const user = users.get(String(answer.user_id));
      const send = sendByQuestionUser.get(
        `${answer.question_id}:${answer.user_id}`,
      );
      const isOpen = item?.kind === "open";

      return {
        id: answer.id,
        answeredAt: answer.answered_at,
        kind: item?.kind ?? null,
        question: item?.body ?? null,
        name: user?.name ?? null,
        email: user?.email ?? null,
        phone: user?.phone_number ?? null,
        tags: user?.tags ?? "",
        channel: send?.channel ?? null,
        assistant: assistantNames.get(String(send?.assistant_id)) ?? null,
        answer: isOpen
          ? answer.answer_text || null
          : optionLabel(item, answer.option_index),
        isCorrect: item?.kind === "quiz" ? answer.is_correct ?? null : null,
        verdict: isOpen ? effectiveVerdict(answer) : null,
        feedback: isOpen ? answer.ai_feedback || null : null,
        reviewNeeded: isOpen ? answer.review_needed === true : null,
        questionId: answer.question_id,
        userId: answer.user_id,
      };
    });

  return { questions: questionRows, answers: answerRows };
}
