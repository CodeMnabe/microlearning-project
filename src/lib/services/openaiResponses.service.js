import { openai } from "@/lib/openai/client";
import { getStoreById } from "../repos/store.repo";
import { stripOpenAICitations } from "./removeOAiCitations";

function buildConversationMetadata(metadata = {}) {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]),
  );
}

export async function createConversation(metadata = {}, items = []) {
  const cleanMetadata = buildConversationMetadata(metadata);

  const cleanItems = Array.isArray(items) ? items.slice(-20) : [];

  const conversation = await openai.conversations.create({
    ...(Object.keys(cleanMetadata).length ? { metadata: cleanMetadata } : {}),

    ...(cleanItems.length ? { items: cleanItems } : {}),
  });

  if (!conversation?.id) {
    throw new Error("OpenAI did not return a conversation ID");
  }

  return conversation;
}

export async function resolveAssistantVectorStore(assistant) {
  if (!assistant?.vector_store_id) {
    return null;
  }

  const storeId = Number(assistant.vector_store_id);

  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw new Error(
      `Assistant has an invalid vector_store_id: ${assistant.vector_store_id}`,
    );
  }

  const store = await getStoreById(storeId);

  if (!store) {
    throw new Error(
      `Vector store ${storeId} linked to assistant ${assistant.id} was not found`,
    );
  }

  if (!store.open_ai_id) {
    throw new Error(`Vector store ${storeId} has no OpenAI vector store ID`);
  }

  return store.open_ai_id;
}

export async function generateAssistantResponse({
  assistant,
  conversationId,
  message,
}) {
  if (!assistant) {
    throw new Error("Assistant configuration is required");
  }

  if (!assistant.id) {
    throw new Error("Assistant ID is required");
  }

  if (!assistant.model) {
    throw new Error(
      `Assistant ${assistant.id} does not have a model configured`,
    );
  }

  if (!conversationId) {
    throw new Error("OpenAI conversation ID is required");
  }

  const cleanMessage = typeof message === "string" ? message.trim() : "";

  if (!cleanMessage) {
    throw new Error("Message is required");
  }

  const vectorStoreOpenAiId = await resolveAssistantVectorStore(assistant);

  const request = {
    model: assistant.model,
    conversation: conversationId,
    input: cleanMessage,
  };

  if (
    typeof assistant.model === "string" &&
    assistant.model.startsWith("gpt-5.6")
  ) {
    request.reasoning = {
      effort: "none",
    };
  }

  if (
    typeof assistant.instructions === "string" &&
    assistant.instructions.trim()
  ) {
    request.instructions = assistant.instructions.trim();
  }

  if (assistant.temperature !== null && assistant.temperature !== undefined) {
    request.temperature = Number(assistant.temperature);
  }

  if (assistant.top_p !== null && assistant.top_p !== undefined) {
    request.top_p = Number(assistant.top_p);
  }

  if (vectorStoreOpenAiId) {
    request.tools = [
      {
        type: "file_search",
        vector_store_ids: [vectorStoreOpenAiId],
      },
    ];
  }

  const response = await openai.responses.create(request);

  if (response.error) {
    throw new Error(response.error.message || "OpenAI response failed");
  }

  const rawText =
    typeof response.output_text === "string" ? response.output_text.trim() : "";

  const aiResponse = stripOpenAICitations(rawText);

  return {
    responseId: response.id,
    conversationId,
    aiResponse,
  };
}
