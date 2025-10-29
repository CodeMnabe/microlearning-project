// src/lib/repos/files.repo.js
import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // server-side writes
  { auth: { persistSession: false } }
);

/**
 * Create a file row.
 * Preferred signature:
 *    createDBFile({ vectorStoreId, openAiId, name, size })
 *
 * Back-compat (will try to infer):
 *    createDBFile(openAiId, { name, size, vectorStoreId? })
 */
export async function createDBFile(arg1, arg2) {
  // Normalize args
  let vectorStoreId, openAiId, name, size;

  if (typeof arg1 === "object" && arg1 !== null) {
    // new signature
    ({ vectorStoreId, openAiId, name, size } = arg1);
  } else {
    // back-compat: (openAiId, fileLike)
    openAiId = arg1;
    name = arg2?.name;
    size = arg2?.size;
    vectorStoreId = arg2?.vectorStoreId ?? arg2?.vector_store_id ?? null;
  }

  const { data, error } = await sb
    .from("file")
    .insert([
      {
        vector_store_id: vectorStoreId, // may be null during upload phase
        open_ai_id: openAiId,
        name,
        size,
      },
    ])
    .select("id, vector_store_id, open_ai_id, name, size")
    .single();

  if (error) throw error;
  return data; // { id, vector_store_id, open_ai_id, name, size }
}

/** Get one file by id */
export async function getFileById(id) {
  const { data, error } = await sb
    .from("file")
    .select("id, vector_store_id, open_ai_id, name, size")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

/** List files in a vector store (handy sometimes) */
export async function listFilesInStore(vectorStoreId) {
  const { data, error } = await sb
    .from("file")
    .select("id, vector_store_id, open_ai_id, name, size")
    .eq("vector_store_id", vectorStoreId)
    .order("id", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Delete one file row */
export async function deleteFileById(id) {
  const { error } = await sb.from("file").delete().eq("id", id);
  if (error) throw error;
  return true;
}

/** Optional: set/clear the vector store after you’ve created it */
export async function attachFileToStore(fileId, vectorStoreId) {
  const { error } = await sb
    .from("file")
    .update({ vector_store_id: vectorStoreId })
    .eq("id", fileId);
  if (error) throw error;
  return true;
}
