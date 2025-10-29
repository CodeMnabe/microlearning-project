// src/lib/services/oAi.services.js
import { oai as client } from "@/utils/oAi/oAi.client";
import { stripOpenAICitations } from "./removeOAiCitations";

/* ----------------------------- helpers ----------------------------- */

function getVectorStoresAPI() {
  // Support both shapes depending on SDK version
  return client.beta?.vectorStores ?? client.vectorStores ?? null;
}

function getFileBatchesAPI() {
  return (
    client.beta?.vectorStores?.fileBatches ??
    client.vectorStores?.fileBatches ??
    null
  );
}

/* --------------------------- Assistants CRUD --------------------------- */
/* Kept as-is so your DB continues to store open_ai_id etc. */
export async function createOAiAssistant(body) {
  return client.beta.assistants.create({
    name: body.name,
    description: body.description,
    instructions: body.instructions,
    model: body.model,
    top_p: body.top_p,
    temperature: body.temperature,
    tools: [{ type: "file_search" }],
  });
}

export async function getOAiAssistantById(id) {
  return client.beta.assistants.retrieve(`${id}`);
}

export async function updateOAiAssistant(updates) {
  return client.beta.assistants.update(`${updates.open_ai_id}`, {
    name: updates.name,
    description: updates.description,
    instructions: updates.instructions,
    model: updates.model,
    top_p: updates.top_p,
    temperature: updates.temperature,
  });
}

export async function deleteOAiAssistant(id) {
  return client.beta.assistants.del(`${id}`);
}

/* --------------------------- Files & Stores --------------------------- */

export async function createOAiFile(file) {
  try {
    return await client.files.create({ file, purpose: "assistants" });
  } catch (err) {
    throw new Error(err?.message || "OpenAI file upload failed");
  }
}

/**
 * Correct vector-store flow:
 * 1) Create store
 * 2) Attach files via fileBatches.create
 */
export async function createOAiVectorStore(storeName, fileIds = []) {
  try {
    if (!storeName?.trim()) throw new Error("Name cannot be empty");

    const vs = getVectorStoresAPI();
    if (!vs?.create) {
      throw new Error(
        "Vector Stores API not available in your installed 'openai' package. Update to the latest version."
      );
    }

    const store = await vs.create({ name: storeName });

    if (fileIds.length) {
      const batches = getFileBatchesAPI();
      if (!batches?.create) {
        throw new Error(
          "Your 'openai' SDK lacks vectorStores.fileBatches.create. Please upgrade."
        );
      }
      await batches.create(store.id, { file_ids: fileIds });
    }

    return store;
  } catch (err) {
    throw new Error(err?.message || "OpenAI vector store create failed");
  }
}

export async function associateStoreToAssistant(assistantId, store) {
  try {
    return await client.beta.assistants.update(assistantId, {
      tool_resources: { file_search: { vector_store_ids: [store.id] } },
    });
  } catch (err) {
    throw new Error(err?.message || "Failed to associate store to assistant");
  }
}

export async function deleteOAiVectorStoreAndFiles(storeId, fileIds = []) {
  try {
    for (const fid of fileIds) {
      if (client.files?.del) {
        await client.files.del(fid);
      } else if (client.files?.delete) {
        await client.files.delete(fid);
      } else {
        throw new Error(
          "Your 'openai' SDK lacks files.del/delete. Please upgrade."
        );
      }
    }

    const vs = client.beta?.vectorStores ?? client.vectorStores ?? null;
    if (!vs)
      throw new Error("Vector Stores API not available in this 'openai' SDK.");

    if (vs.del) {
      const res = await vs.del(storeId);
      return res?.deleted ?? true;
    } else if (vs.delete) {
      const res = await vs.delete(storeId);
      return res?.deleted ?? true;
    } else {
      throw new Error(
        "Your 'openai' SDK lacks vectorStores.del/delete. Please upgrade."
      );
    }
  } catch (err) {
    throw new Error(err?.message || "Failed to delete store/files");
  }
}

/* ----------------------------- Messaging (Responses API) ----------------------------- */
/**
 * One-shot reply using the Responses API.
 * - Pass model/instructions from your DB "assistant" row.
 * - Optionally include a vector store (OpenAI id) to enable file_search.
 */
export async function respondOnce({
  model,
  instructions,
  input,
  vectorStoreOpenAiId,
}) {
  const payload = {
    model: model || "gpt-4.1-mini",
    input,
    ...(instructions ? { instructions } : {}),
  };

  if (vectorStoreOpenAiId) {
    payload.tools = [{ type: "file_search" }];
    payload.tool_resources = {
      file_search: { vector_store_ids: [vectorStoreOpenAiId] },
    };
  }

  const resp = await client.responses.create(payload);
  const text = resp.output_text || "";
  return stripOpenAICitations(text);
}

/* Legacy name kept so you don't have to refactor all imports.
   It now wraps Responses instead of Threads/Runs. */
export async function sendMessageToAi(
  assistantId_unused,
  input,
  threadId_unused
) {
  // If you still call this somewhere, at least don't break:
  const resp = await client.responses.create({
    model: "gpt-4.1-mini",
    input,
  });
  return { threadId: null, aiResponse: resp.output_text || "" };
}
