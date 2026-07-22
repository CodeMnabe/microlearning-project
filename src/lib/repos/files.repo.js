// /src/lib/repos/files.repo.js
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * Table: file
 *  - id (int4, PK)
 *  - vector_store_id (int4, FK -> vector_store.id)
 *  - open_ai_id (text)
 *  - name (text)
 *  - size (int4)
 *
 * IMPORTANT:
 *  • Use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS for server-side ops)
 *  • Prefer DB-level cleanup via ON DELETE CASCADE on file.vector_store_id
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
    status: 'active',
    upload_flow: 'legacy'
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
    status: 'active',
    upload_flow: 'legacy'
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

/** Delete a single file row (Legacy hard delete, avoid using) */
export async function deleteFileById(id) {
  const { error } = await sb.from("file").delete().eq("id", id);
  if (error) throw error;
  return true;
}

/** Soft delete a single file by setting pending_delete */
export async function markFilePendingDelete(fileId, organizationId, reason = null) {
  const fromStates = ['pending_upload', 'uploaded', 'validating', 'validated', 'processing', 'active', 'rejected', 'retryable_failed', 'unknown_outcome', 'reconciliation_required'];
  return await transitionFileLifecycle({
    fileId,
    organizationId,
    from: fromStates,
    to: 'pending_delete',
    metadata: {
      cleanup_reason: reason,
      // Record original status before delete if needed, but for now we just append cleanup_reason
    }
  });
}

/**
 * Transition file lifecycle state with compare-and-set
 */
export async function transitionFileLifecycle({
  fileId,
  organizationId,
  from,
  to,
  metadata = {}
}) {
  const fromStates = Array.isArray(from) ? from : [from];

  const payload = {
    status: to,
    updated_at: new Date().toISOString(),
    ...metadata
  };

  const { data, error } = await sb
    .from("file")
    .update(payload)
    .eq("id", fileId)
    .eq("organization_id", organizationId)
    .in("status", fromStates)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error(`File lifecycle transition failed or unauthorized. fileId=${fileId}`);
    }
    throw error;
  }

  return data;
}

/**
 * Delete all files of a vector store (Legacy hard delete, avoid using)
 */
export async function deleteFilesByVectorStoreId(vectorStoreId) {
  const { error } = await sb
    .from("file")
    .delete()
    .eq("vector_store_id", vectorStoreId);
  if (error) throw error;
  return true;
}

/**
 * Soft delete all files of a vector store by setting pending_delete
 */
export async function markVectorStoreFilesPendingDelete(vectorStoreId, organizationId, reason = null) {
  const fromStates = ['pending_upload', 'uploaded', 'validating', 'validated', 'processing', 'active', 'rejected', 'retryable_failed', 'unknown_outcome', 'reconciliation_required'];

  const { error } = await sb
    .from("file")
    .update({
      status: 'pending_delete',
      cleanup_reason: reason,
      updated_at: new Date().toISOString()
    })
    .eq("vector_store_id", vectorStoreId)
    .eq("organization_id", organizationId)
    .in("status", fromStates);

  if (error) throw error;
  return true;
}

/**
 * Soft delete all files of an assistant by setting pending_delete and detaching from the assistant
 */
export async function markAssistantFilesPendingDeleteAndDetach(assistantId, organizationId, reason = null) {
  const fromStates = ['pending_upload', 'uploaded', 'validating', 'validated', 'processing', 'active', 'rejected', 'retryable_failed', 'unknown_outcome', 'reconciliation_required'];

  const { error } = await sb
    .from("file")
    .update({
      status: 'pending_delete',
      assistant_id: null,
      cleanup_reason: reason,
      updated_at: new Date().toISOString()
    })
    .eq("assistant_id", assistantId)
    .eq("organization_id", organizationId)
    .in("status", fromStates);

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
