import { getAssistantById } from "@/lib/repos/assistants";

import { sendMessageToAssistant } from "@/lib/services/openai";

/**
 * Service de mensagens da camada Assistants.
 *
 * Gere:
 * - envio de mensagens no chat sandbox;
 * - validação da mensagem recebida;
 * - carregamento do assistente interno;
 * - resolução do ID do assistente na OpenAI;
 * - criação ou reutilização de thread;
 * - envio da mensagem para a OpenAI;
 * - devolução da resposta do assistente.
 *
 * Este service coordena o fluxo de chat dos assistentes.
 *
 */

export async function sendAssistantMessageService({
  assistantId,
  message,
  threadId,
  openAiAssistantIdOverride,
}) {
  if (!message?.trim()) {
    const error = new Error("Missing message");
    error.status = 400;
    throw error;
  }

  const dbAssistant = await getAssistantById(assistantId);

  if (!dbAssistant) {
    const error = new Error("Assistant not found");
    error.status = 404;
    throw error;
  }

  const openAiAssistantId =
    openAiAssistantIdOverride || dbAssistant.open_ai_id;

  return sendMessageToAssistant({
    openAiAssistantId,
    message,
    threadId,
  });
}