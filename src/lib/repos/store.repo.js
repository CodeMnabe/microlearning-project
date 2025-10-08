// src/lib/repos/store.repo.js
import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Table: vector_store
 *   id (int4), store_name (text), open_ai_id (text)  ← ensure this column exists
 *
 * Table: file
 *   id (int4), vector_store_id (int4 FK), open_ai_id (text), name (text), size (int4)
 */

export async function createDBStore(store, fileRows = []) {
  // 1) Create vector_store (persist OpenAI id too)
  const { data: vs, error: vsErr } = await sb
    .from("vector_store")
    .insert([{ store_name: store.name, open_ai_id: store.open_ai_id || null }])
    .select()
    .single();
  if (vsErr) throw vsErr;

  // 2) Attach files (if any)
  if (fileRows.length) {
    const toInsert = fileRows.map((f) => ({
      vector_store_id: vs.id,
      open_ai_id: f.open_ai_id,
      name: f.name,
      size: f.size,
    }));
    const { error: filesErr } = await sb.from("file").insert(toInsert);
    if (filesErr) throw filesErr;
  }

  // 3) Return the store *with* its files (id, name, size)
  const { data: full, error: fullErr } = await sb
    .from("vector_store")
    .select("id, store_name, open_ai_id, file:file(id, name, size, open_ai_id)")
    .eq("id", vs.id)
    .single();
  if (fullErr) throw fullErr;

  return full;
}

export async function getStoreById(storeId) {
  const { data, error } = await sb
    .from("vector_store")
    .select("id, store_name, open_ai_id, file:file(id, name, size, open_ai_id)")
    .eq("id", storeId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function deleteStoreById(storeId) {
  const { error } = await sb.from("vector_store").delete().eq("id", storeId);
  if (error) throw error;
  return true;
}
