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

/**
 * Lista os runs de uma organização.
 *
 * Mantém a query que existia diretamente em:
 * /api/automations/runs
 */
export async function getOrganizationAutomationRuns({
  organizationId,
  limit = 100,
}) {
  const { data, error } = await sb
    .from("automation_run")
    .select(
      `
        *,
        user_row:user_id (
          id,
          name
        )
      `,
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data || [];
}

/**
 * Lista os runs que já possuem um scheduled broadcast.
 *
 * Mantém a query que existia diretamente em:
 * /api/automations/materialized
 */
export async function getOrganizationMaterializedAutomationRuns({
  organizationId,
  limit = 100,
}) {
  const { data, error } = await sb
    .from("automation_run")
    .select(
      `
        *,
        user_row:user!automation_run_user_id_fkey (
          id,
          name,
          email
        ),
        scheduled_broadcast:scheduled_broadcast!automation_run_scheduled_broadcast_id_fkey (
          id,
          status,
          channel,
          scheduled_for,
          payload,
          recipient_count,
          created_at
        )
      `,
    )
    .eq("organization_id", organizationId)
    .not("scheduled_broadcast_id", "is", null)
    .order("scheduled_for", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data || [];
}
