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

export async function materializeVectorStoreCapacity({
  organizationId,
  assistantId,
  reservationKey,
  storeName,
  remoteId,
}) {
  const { data, error } = await sb.rpc("materialize_vector_store_capacity", {
    p_organization_id: organizationId,
    p_assistant_id: assistantId,
    p_reservation_key: reservationKey,
    p_store_name: storeName,
    p_remote_id: remoteId,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function getStoreByCapacityReservation(organizationId, reservationId) {
  const { data, error } = await sb
    .from("vector_store")
    .select("id, store_name, open_ai_id, status, file:file(id, name, size, open_ai_id)")
    .eq("organization_id", organizationId)
    .eq("capacity_reservation_id", reservationId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getStoreById(storeId) {
  const { data, error } = await sb
    .from("vector_store")
    .select("id, store_name, open_ai_id, organization_id, capacity_reservation_id, status, file:file(id, name, size, open_ai_id)")
    .eq("id", storeId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function transitionVectorStoreLifecycle(storeId, organizationId, from, to, metadata = {}) {
  const fromStates = Array.isArray(from) ? from : [from];
  const { data, error } = await sb
    .from("vector_store")
    .update({ ...metadata, status: to })
    .eq("id", storeId)
    .eq("organization_id", organizationId)
    .in("status", fromStates)
    .select()
    .single();
  if (error) throw error;
  return data;
}
