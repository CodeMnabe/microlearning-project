import {
  EXPIRED_QUESTION_TEXT,
  extractInboundReply,
  isQuestionExpired,
  quizFeedbackText,
  resolveQuizOption,
} from "@/lib/whatsapp/question";
import {
  createMessage,
  getMessageByProviderId,
  getRecentQuestionMessagesForUser,
} from "@/lib/repos/messages.repo";
import {
  createQuestionAnswer,
  getQuestionAnswer,
  getQuestionById,
} from "@/lib/repos/questions.repo";

const defaultDeps = {
  createMessage,
  getMessageByProviderId,
  getRecentQuestionMessagesForUser,
  createQuestionAnswer,
  getQuestionAnswer,
  getQuestionById,
};

/**
 * Descobre a que pergunta esta mensagem responde.
 *
 * 1. Um toque num botão traz `replyTo.id`, o id da mensagem que enviámos.
 *    Se essa mensagem tiver pergunta, é essa.
 * 2. Texto escrito à mão: conta como resposta se for igual a uma opção da
 *    pergunta mais recente ainda por responder.
 *
 * Devolve null quando a mensagem não é resposta a nenhuma pergunta.
 */
export async function findQuestionForReply({ user, payload, deps }) {
  const d = { ...defaultDeps, ...deps };
  const reply = extractInboundReply(payload);

  if (reply.replyToMessageId) {
    const message = await d.getMessageByProviderId(
      reply.replyToMessageId,
      user.organization_id,
    );

    if (message?.question_id) {
      const question = await d.getQuestionById(message.question_id);

      if (question) {
        return { reply, question, message };
      }
    }

    /*
     * Um toque num botão que não é de pergunta (por exemplo o "Aceito" da
     * abertura) não é resposta a nada.
     */
    if (reply.isTap) return null;
  }

  if (reply.isTap || !reply.text.trim()) return null;

  const recent = await d.getRecentQuestionMessagesForUser(user.id, 1);
  const message = recent[0];

  if (!message?.question_id) return null;

  const question = await d.getQuestionById(message.question_id);

  if (!question || question.kind !== "quiz" || isQuestionExpired(question)) {
    return null;
  }

  if (!resolveQuizOption({ reply, options: question.options })) {
    return null;
  }

  return { reply, question, message };
}

/**
 * Trata uma mensagem recebida como resposta a uma pergunta.
 *
 * Devolve `{ handled: false }` quando a mensagem não responde a nenhuma
 * pergunta e deve seguir o caminho normal (assistente de IA). Caso
 * contrário regista a resposta, envia o feedback e devolve o resultado.
 *
 * Só a primeira resposta conta: toques seguintes à mesma pergunta ficam
 * guardados na conversa mas não recebem feedback nem vão à IA.
 */
export async function handleQuestionReply({
  user,
  payload,
  inboundMsgId = null,
  contactId = null,
  sendText,
  resolveThread,
  deps,
}) {
  const d = { ...defaultDeps, ...deps };

  const found = await findQuestionForReply({ user, payload, deps: d });

  if (!found) return { handled: false };

  const { reply, question, message } = found;

  /* Perguntas abertas são tratadas na issue #102. */
  if (question.kind !== "quiz") return { handled: false };

  const option = resolveQuizOption({ reply, options: question.options });

  if (!option) return { handled: false };

  const thread = (await resolveThread?.()) || {};

  const inboundRow = await d.createMessage({
    threadId: thread.threadId ?? null,
    userId: user.id,
    organizationId: user.organization_id,
    assistantId: thread.assistantId ?? user.assistant_id ?? null,
    channel: "whatsapp",
    messageId: inboundMsgId,
    externalContactId: contactId,
    content: reply.text,
    role: "user",
  });

  async function reply_(text) {
    const sendRes = await sendText(text);

    await d.createMessage({
      threadId: thread.threadId ?? null,
      userId: user.id,
      organizationId: user.organization_id,
      assistantId: thread.assistantId ?? user.assistant_id ?? null,
      channel: "whatsapp",
      messageId: sendRes?.providerMessageId || null,
      externalContactId: contactId,
      content: text,
      role: "assistant",
      deliveryStatus: sendRes?.ok ? "accepted" : "failed",
      failedAt: sendRes?.ok ? null : new Date().toISOString(),
    });

    return sendRes;
  }

  if (isQuestionExpired(question)) {
    await reply_(EXPIRED_QUESTION_TEXT);

    return {
      handled: true,
      outcome: "expired",
      questionId: question.id,
    };
  }

  const isCorrect = Boolean(question.options?.[option.index]?.correct);

  const answer = await d.createQuestionAnswer({
    questionId: question.id,
    organizationId: user.organization_id,
    userId: user.id,
    messageId: message?.id ?? null,
    inboundMessageId: inboundMsgId,
    answerText: reply.text,
    optionIndex: option.index,
    isCorrect,
  });

  if (!answer) {
    return {
      handled: true,
      outcome: "duplicate",
      questionId: question.id,
      inboundMessageRowId: inboundRow?.id ?? null,
    };
  }

  const feedback = quizFeedbackText(question, isCorrect);

  await reply_(feedback);

  return {
    handled: true,
    outcome: "answered",
    questionId: question.id,
    answerId: answer.id,
    optionIndex: option.index,
    matchedBy: option.matchedBy,
    isCorrect,
    feedback,
  };
}
