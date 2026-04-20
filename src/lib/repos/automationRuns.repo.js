import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export async function createAutomationRun(row) {
  const { data, error } = await sb
    .from("automation_run")
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createAutomationRunIfMissing(row) {
  try {
    return await createAutomationRun(row);
  } catch (error) {
    if (error?.code === "23505") {
      return null;
    }
    throw error;
  }
}

export async function getAutomationRunById(id) {
  const { data, error } = await sb
    .from("automation_run")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getDueAutomationRuns(limit = 100) {
  const nowIso = new Date().toISOString();

  const { data, error } = await sb
    .from("automation_run")
    .select("*")
    .eq("status", "queued")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function markAutomationRunMaterialized(id, scheduledBroadcastId) {
  const { data, error } = await sb
    .from("automation_run")
    .update({
      status: "materialized",
      scheduled_broadcast_id: scheduledBroadcastId,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "queued")
    .select()
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function markAutomationRunProcessing(id) {
  const { data, error } = await sb
    .from("automation_run")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["queued", "materialized"])
    .select()
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function markAutomationRunSent(id) {
  const { data, error } = await sb
    .from("automation_run")
    .update({
      status: "sent",
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markAutomationRunFailed(id, lastError = null) {
  const { data, error } = await sb
    .from("automation_run")
    .update({
      status: "failed",
      last_error: lastError,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markAutomationRunCancelled(id, lastError = null) {
  const { data, error } = await sb
    .from("automation_run")
    .update({
      status: "cancelled",
      last_error: lastError,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
