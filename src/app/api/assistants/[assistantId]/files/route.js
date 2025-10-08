// /lib/repos/files.repo.js
import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Table: file
 * cols: id (int4), open_ai_id (text), name (text), size (int4), vector_store_id (int4, FK)
 */

export async function createDBFile(openAiId, file, vectorStoreId = null) {
  const { data, error } = await sb
    .from("file")
    .insert([
      {
        open_ai_id: openAiId,
        name: file.name,
        size: file.size,
        vector_store_id: vectorStoreId,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data; // return the full row (id, etc.)
}

export async function getFileById(id) {
  const { data, error } = await sb
    .from("file")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFileById(id) {
  const { error } = await sb.from("file").delete().eq("id", id);
  if (error) throw error;
  return true;
}
