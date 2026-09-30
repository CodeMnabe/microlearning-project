import { openai } from "@/lib/openai/client";

/** Acrescenta o diálogo ao contexto sem pedir outra resposta ao modelo. */
export async function appendQuestionContext({
  conversationId,
  question,
  answerText,
  replies,
  deps = {},
}) {
  if (!conversationId) throw new Error("Falta a conversa OpenAI do contacto.");
  const items = [
    { type: "message", role: "assistant", content: question.body },
    { type: "message", role: "user", content: answerText },
    ...replies.map((content) => ({
      type: "message",
      role: "assistant",
      content,
    })),
  ];
  await (deps.openai || openai).conversations.items.create(
    conversationId,
    { items },
    { timeout: 10000, maxRetries: 0 },
  );
}
