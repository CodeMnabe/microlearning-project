/**
 * Perguntas no Teams (#151).
 *
 * Quiz e sondagem vão num Adaptive Card com um botão por opção. Cada botão é
 * um messageBack: a opção aparece na conversa como se o colaborador a tivesse
 * escrito, e chega ao bot com `text` igual à opção e `value` com o índice.
 * A pergunta aberta vai em texto simples e a resposta é a mensagem seguinte.
 *
 * Este ficheiro não lê variáveis de ambiente.
 */

export const QUESTION_CARD_ACTION = "mdbQuestionOption";

export function buildQuestionCard({ text, options = [] }) {
  return {
    contentType: "application/vnd.microsoft.card.adaptive",
    content: {
      type: "AdaptiveCard",
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      version: "1.4",
      body: [{ type: "TextBlock", text: String(text ?? ""), wrap: true }],
      actions: options.map((option, index) => ({
        type: "Action.Submit",
        title: option.label,
        data: {
          msteams: {
            type: "messageBack",
            displayText: option.label,
            text: option.label,
          },
          action: QUESTION_CARD_ACTION,
          optionIndex: index,
        },
      })),
    },
  };
}

/**
 * Resposta no formato que o handleQuestionReply espera (o mesmo que o
 * extractInboundReply devolve para o Bird).
 */
export function extractTeamsReply(activity = {}) {
  const value = activity?.value;
  const isTap =
    value?.action === QUESTION_CARD_ACTION &&
    Number.isInteger(value?.optionIndex);
  const text = typeof activity?.text === "string" ? activity.text.trim() : "";

  return {
    text,
    isTap,
    tappedIndex: isTap ? value.optionIndex : null,
    tappedText: isTap ? text || null : null,
    replyToMessageId:
      isTap && activity?.replyToId ? String(activity.replyToId) : null,
  };
}
