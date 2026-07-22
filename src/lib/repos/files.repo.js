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

export async function reserveFileCapacity({
  organizationId,
  assistantId = null,
  reservationKey,
  uploadFlow,
  files,
  expiresAt,
  requestedVectorStoreCount,
}) {
  const { data, error } = await sb.rpc("reserve_file_capacity", {
    p_organization_id: organizationId,
    p_assistant_id: assistantId,
    p_reservation_key: reservationKey,
    p_upload_flow: uploadFlow,
    p_files: files,
    p_expires_at: expiresAt,
    p_requested_vector_store_count: requestedVectorStoreCount,
  });
  if (error) throw error;
  return data ?? [];
}

export async function getFileCapacityReservation(organizationId, reservationKey) {
  const { data, error } = await sb
    .from("file_capacity_reservation")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("reservation_key", reservationKey)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getFilesByCapacityReservation(organizationId, reservationId) {
  const { data, error } = await sb
    .from("file")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("capacity_reservation_id", reservationId)
    .order("id", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function adjustFileReservedCapacity(organizationId, fileId, actualBytes) {
  const { data, error } = await sb.rpc("adjust_file_reserved_capacity", {
    p_organization_id: organizationId,
    p_file_id: fileId,
    p_actual_bytes: actualBytes,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function completeFileCleanup({
  organizationId,
  fileId,
  storageDeleted,
  publicObjectDeleted,
  openAiDeleted,
}) {
  const { data, error } = await sb.rpc("complete_file_cleanup", {
    p_organization_id: organizationId,
    p_file_id: fileId,
    p_storage_deleted: storageDeleted,
    p_public_object_deleted: publicObjectDeleted,
    p_openai_deleted: openAiDeleted,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function markFileCapacityReconciliationRequired({
  organizationId,
  reservationKey,
  remoteVectorStoreId,
  errorMessage,
}) {
  const normalizedRemoteId = typeof remoteVectorStoreId === "string"
    ? remoteVectorStoreId.trim()
    : "";
  if (!normalizedRemoteId) {
    throw new Error("A remote vector store id is required for reconciliation");
  }
  const { error } = await sb.rpc("mark_file_capacity_reconciliation_required", {
    p_organization_id: organizationId,
    p_reservation_key: reservationKey,
    p_remote_vector_store_id: normalizedRemoteId,
    p_error_message: errorMessage?.slice(0, 1000) ?? null,
  });
  if (error) throw error;
}

export async function listFileCapacityReconciliations(limit = 20) {
  const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 20;
  const { data, error } = await sb
    .from("file_capacity_reservation")
    .select("id, organization_id, reservation_key, remote_vector_store_id, status")
    .eq("status", "reconciliation_required")
    .not("remote_vector_store_id", "is", null)
    .order("updated_at", { ascending: true })
    .limit(safeLimit);
  if (error) throw error;
  return data ?? [];
}

export async function completeFileCapacityReconciliation({
  organizationId,
  reservationKey,
  remoteVectorStoreId,
  remoteCleanupConfirmed,
}) {
  const { data, error } = await sb.rpc("complete_file_capacity_reconciliation", {
    p_organization_id: organizationId,
    p_reservation_key: reservationKey,
    p_remote_vector_store_id: remoteVectorStoreId,
    p_remote_cleanup_confirmed: remoteCleanupConfirmed,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

/** Get one file by id */
export async function getFileById(id, organizationId) {
  const { data, error } = await sb
    .from("file")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
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

  if ("size_bytes" in metadata || "reserved_bytes" in metadata || "capacity_reservation_id" in metadata) {
    throw new Error("Capacity fields must be changed through the capacity RPCs");
  }

  const payload = {
    ...metadata,
    status: to,
    updated_at: new Date().toISOString(),
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
