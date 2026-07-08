// /src/lib/repos/files.repo.js
import { createClient as createServiceClient } from "@supabase/supabase-js";


/**
 * Repo da tabela file associada às vector stores.
 *
 * Gere:
 * - criação de registos de ficheiros;
 * - criação de múltiplos ficheiros;
 * - carregamento de ficheiros por ID;
 * - listagem de ficheiros por vector store;
 * - remoção de ficheiros;
 * - desassociação de ficheiros de uma vector store.
 *
 * Este repo guarda apenas metadados dos ficheiros na base de dados.
 *
 * Não deve:
 * - fazer upload para Supabase Storage;
 * - enviar ficheiros para a OpenAI;
 * - conter lógica de vector store;
 * - renderizar JSX;
 * - usar hooks React.
 */

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/** Create a single file row */
export async function createDBFile(openAiId, file, vectorStoreId = null) {
  const payload = {
    open_ai_id: openAiId ?? null,
    name: file?.name ?? null,
    size: file?.size ?? null,
    vector_store_id: vectorStoreId ?? null,
  };

  const { data, error } = await sb
    .from("file")
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return data; // { id, open_ai_id, name, size, vector_store_id }
}

/** Bulk create file rows; accepts [{ open_ai_id, name, size }] */
export async function createDBFiles(fileRows = [], vectorStoreId = null) {
  if (!Array.isArray(fileRows) || fileRows.length === 0) return [];

  const toInsert = fileRows.map((f) => ({
    vector_store_id: vectorStoreId ?? null,
    open_ai_id: f.open_ai_id ?? f.openAiId ?? null,
    name: f.name ?? null,
    size: f.size ?? null,
  }));

  const { data, error } = await sb.from("file").insert(toInsert).select();
  if (error) throw error;
  return data; // array of inserted rows
}

/** Get one file by id */
export async function getFileById(id) {
  const { data, error } = await sb
    .from("file")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

/** List files for a vector store */
export async function getFilesByVectorStoreId(vectorStoreId) {
  const { data, error } = await sb
    .from("file")
    .select("*")
    .eq("vector_store_id", vectorStoreId);
  if (error) throw error;
  return data ?? [];
}

/** Delete a single file row */
export async function deleteFileById(id) {
  const { error } = await sb.from("file").delete().eq("id", id);
  if (error) throw error;
  return true;
}

/**
 * Delete all files of a vector store (useful if you DIDN'T set CASCADE).
 * If you have ON DELETE CASCADE, you can skip calling this and just delete the store.
 */
export async function deleteFilesByVectorStoreId(vectorStoreId) {
  const { error } = await sb
    .from("file")
    .delete()
    .eq("vector_store_id", vectorStoreId);
  if (error) throw error;
  return true;
}

/** Optional: detach files from a vector store without deleting them */
export async function detachFilesFromVectorStore(vectorStoreId) {
  const { error } = await sb
    .from("file")
    .update({ vector_store_id: null })
    .eq("vector_store_id", vectorStoreId);
  if (error) throw error;
  return true;
}
