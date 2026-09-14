/**
 * Agregação dos resultados das perguntas para a página de resultados.
 *
 * Funções puras: recebem as linhas já lidas da base de dados e devolvem o
 * que a página mostra. Assim testam-se sem Supabase.
 */

export const VERDICTS = ["completa", "parcial", "incompleta"];

function percent(part, total) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

/**
 * Veredicto que conta: o do administrador, quando corrigiu, senão o da IA.
 */
export function effectiveVerdict(answer) {
  return answer?.admin_verdict || answer?.verdict || null;
}

function emptyVerdicts() {
  return { completa: 0, parcial: 0, incompleta: 0, semVeredicto: 0 };
}

function countVerdicts(answers) {
  const counts = emptyVerdicts();

  for (const answer of answers) {
    const verdict = effectiveVerdict(answer);

    if (VERDICTS.includes(verdict)) counts[verdict] += 1;
    else counts.semVeredicto += 1;
  }

  return counts;
}

function distinctUserIds(rows) {
  return new Set(
    rows
      .map((row) => row?.user_id)
      .filter((id) => id != null)
      .map(String),
  );
}

function summarizeQuestion(question, messages, answers) {
  const recipients = distinctUserIds(messages);
  const answered = distinctUserIds(answers);

  /*
   * Quem respondeu conta como destinatário mesmo que a mensagem de envio
   * não tenha ficado registada (envios antigos).
   */
  for (const id of answered) recipients.add(id);

  const isQuiz = question.kind === "quiz";
  const correctCount = isQuiz
    ? answers.filter((answer) => answer.is_correct === true).length
    : null;

  const sentAt = messages.reduce((earliest, row) => {
    if (!row?.created_at) return earliest;
    return !earliest || row.created_at < earliest ? row.created_at : earliest;
  }, null);

  return {
    id: question.id,
    kind: question.kind,
    body: question.body,
    options: Array.isArray(question.options) ? question.options : [],
    expectedAnswer: question.expected_answer || null,
    aiEvaluation: question.ai_evaluation !== false,
    createdAt: question.created_at || null,
    sentAt: sentAt || question.created_at || null,
    expiresAt: question.expires_at || null,
    scheduledBroadcastId: question.scheduled_broadcast_id || null,
    recipientCount: recipients.size,
    answeredCount: answered.size,
    notAnsweredCount: Math.max(recipients.size - answered.size, 0),
    responseRate: percent(answered.size, recipients.size),
    correctCount,
    correctRate: isQuiz ? percent(correctCount, answered.size) : null,
    verdicts: isQuiz ? null : countVerdicts(answers),
    reviewNeededCount: answers.filter((answer) => answer.review_needed === true)
      .length,
  };
}

function groupBy(rows, key) {
  const map = new Map();

  for (const row of rows || []) {
    const id = String(row?.[key]);
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(row);
  }

  return map;
}

/**
 * Lista de perguntas com os totais, da mais recente para a mais antiga.
 *
 * - `messages`: linhas de `message` com `question_id` (uma por destinatário).
 * - `answers`: linhas de `question_answer`.
 */
export function buildQuestionReports({
  questions = [],
  messages = [],
  answers = [],
}) {
  const messagesByQuestion = groupBy(messages, "question_id");
  const answersByQuestion = groupBy(answers, "question_id");

  return (questions || [])
    .map((question) =>
      summarizeQuestion(
        question,
        messagesByQuestion.get(String(question.id)) || [],
        answersByQuestion.get(String(question.id)) || [],
      ),
    )
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function personFields(user) {
  return {
    name: user?.name || null,
    email: user?.email || null,
    phoneNumber: user?.phone_number || null,
  };
}

/**
 * Detalhe de uma pergunta: resumo, quem respondeu e quem não respondeu.
 *
 * - `users`: mapa `id -> user` com quem recebeu a pergunta.
 */
export function buildQuestionDetail({
  question,
  messages = [],
  answers = [],
  users = new Map(),
}) {
  if (!question) return null;

  const summary = summarizeQuestion(question, messages, answers);
  const sentAtByUser = new Map();

  for (const row of messages) {
    if (row?.user_id == null) continue;
    const key = String(row.user_id);
    const current = sentAtByUser.get(key);
    if (!current || (row.created_at && row.created_at < current)) {
      sentAtByUser.set(key, row.created_at || null);
    }
  }

  const answered = [...answers]
    .sort((a, b) => String(a.answered_at).localeCompare(String(b.answered_at)))
    .map((answer) => {
      const user = users.get(String(answer.user_id)) || answer.user || null;
      const optionIndex =
        typeof answer.option_index === "number" ? answer.option_index : null;

      return {
        answerId: answer.id,
        userId: answer.user_id,
        ...personFields(user),
        answerText: answer.answer_text || "",
        optionIndex,
        optionLabel:
          optionIndex != null
            ? summary.options[optionIndex]?.label || null
            : null,
        isCorrect: answer.is_correct ?? null,
        verdict: answer.verdict || null,
        adminVerdict: answer.admin_verdict || null,
        effectiveVerdict: effectiveVerdict(answer),
        aiFeedback: answer.ai_feedback || null,
        reviewNeeded: answer.review_needed === true,
        sentAt: sentAtByUser.get(String(answer.user_id)) || null,
        answeredAt: answer.answered_at || null,
      };
    });

  const answeredIds = new Set(answers.map((answer) => String(answer.user_id)));

  const notAnswered = [...sentAtByUser.entries()]
    .filter(([userId]) => !answeredIds.has(userId))
    .map(([userId, sentAt]) => ({
      userId: Number(userId),
      ...personFields(users.get(userId)),
      sentAt,
    }))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  return { summary, answered, notAnswered };
}
