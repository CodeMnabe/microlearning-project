import { createClient as createServiceClient } from "@supabase/supabase-js";
import { toFile } from "openai/uploads";

import {
  createOAiVectorStore,
  associateStoreToAssistant,
  createOAiFile,
  deleteOAiVectorStoreAndFiles,
} from "@/lib/services/openai";

import {
  associateVectorStoreToDbAssistant,
  getAssistantById,
  nullifyVectorStoreToDbAssistant,
  createDBStore,
  getStoreById,
  deleteStoreById,
  deleteFileById,
} from "@/lib/repos/assistants";

/**
 * Service de vector stores da camada Assistants.
 *
 * Gere:
 * - criação de vector stores para assistentes;
 * - leitura de ficheiros enviados para Supabase Storage;
 * - criação de signed URLs para ficheiros;
 * - envio de ficheiros para a OpenAI;
 * - criação de vector stores na OpenAI;
 * - gravação de vector stores na Supabase;
 * - associação de vector stores a assistentes;
 * - carregamento de vector stores existentes;
 * - remoção de vector stores e ficheiros.
 *
 * Este service coordena Supabase Storage, OpenAI e repos.
 *
 */

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export async function createAssistantVectorStoreService(assistantId, body) {
  const { storeName, files } = body;

  if (!storeName || !Array.isArray(files) || files.length === 0) {
    const error = new Error("Missing storeName/files");
    error.status = 400;
    throw error;
  }

  const uploadedOpenAiIds = [];
  const fileRowsForDb = [];

  for (const file of files) {
    const { bucket, path, name, type, size } = file || {};

    if (!bucket || !path) {
      const error = new Error("Each file needs bucket and path");
      error.status = 400;
      throw error;
    }

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, 60);

    if (signErr) {
      throw signErr;
    }

    const response = await fetch(signed.signedUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${path} from storage: ${response.status} ${response.statusText}`,
      );
    }

    const fileLike = await toFile(
      response.body ?? (await response.blob()),
      name || "upload.bin",
      {
        type:
          type ||
          response.headers.get("content-type") ||
          "application/octet-stream",
      },
    );

    const uploaded = await createOAiFile(fileLike);

    if (!uploaded?.id) {
      throw new Error("Failed to upload a file to OpenAI");
    }

    uploadedOpenAiIds.push(uploaded.id);

    fileRowsForDb.push({
      open_ai_id: uploaded.id,
      name: name || "file",
      size: Number(size) || null,
    });
  }

  const openAiStore = await createOAiVectorStore(storeName, uploadedOpenAiIds);

  if (!openAiStore?.id) {
    throw new Error("Failed to create OpenAI vector store");
  }

  const dbStore = await createDBStore(
    {
      name: openAiStore.name,
      open_ai_id: openAiStore.id,
    },
    fileRowsForDb,
  );

  const dbAssistant = await getAssistantById(assistantId);

  if (!dbAssistant) {
    const error = new Error("Assistant not found");
    error.status = 404;
    throw error;
  }

  await associateStoreToAssistant(dbAssistant.open_ai_id, openAiStore);

  await associateVectorStoreToDbAssistant(assistantId, dbStore.id);

  return {
    id: dbStore.id,
    storeName: dbStore.store_name,
    files: (dbStore.file || []).map(({ id, name, size }) => ({
      id,
      name,
      size,
    })),
  };
}

export async function getAssistantVectorStoreService(storeId) {
  const store = await getStoreById(storeId);

  if (!store) {
    return null;
  }

  return {
    id: store.id,
    storeName: store.store_name,
    files: (store.file || []).map(({ id, name, size }) => ({
      id,
      name,
      size,
    })),
  };
}

export async function deleteAssistantVectorStoreService({
  assistantId,
  storeId,
}) {
  const store = await getStoreById(storeId);

  if (!store) {
    return false;
  }

  const openAiFileIds = (store.file ?? [])
    .map((file) => file.open_ai_id)
    .filter(Boolean);

  const openAiStoreId = store.open_ai_id;

  await nullifyVectorStoreToDbAssistant(assistantId);

  try {
    await deleteOAiVectorStoreAndFiles(openAiStoreId, openAiFileIds);
  } catch (error) {
    console.error("[Assistants] OpenAI vector store delete failed:", error);
  }

  for (const file of store.file ?? []) {
    await deleteFileById(file.id);
  }

  await deleteStoreById(storeId);

  return true;
}