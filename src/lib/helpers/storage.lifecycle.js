import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export async function deleteStorageObjectLifecycle(bucket, path) {
  if (!bucket || !path) return { ok: true, value: null };
  
  const { data, error } = await sb.storage.from(bucket).remove([path]);
  if (error) {
    return { ok: false, outcome: "retryable_failed", code: error.name || "storage_error", message: error.message };
  }
  return { ok: true, value: data };
}
