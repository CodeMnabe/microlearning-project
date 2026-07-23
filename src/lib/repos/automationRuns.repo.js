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

export async function getAutomationRunForScheduledBroadcast({
  id,
  organizationId,
  scheduledBroadcastId,
}) {
  if (!id || !organizationId || !scheduledBroadcastId) return null;

  const { data, error } = await sb
    .from("automation_run")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("scheduled_broadcast_id", scheduledBroadcastId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getDueAutomationRunsForOrganization(organizationId, limit = 100) {
  if (!organizationId) throw new Error("organizationId is required");

  const nowIso = new Date().toISOString();

  const { data, error } = await sb
    .from("automation_run")
    .select("*")
    .eq("status", "queued")
    .eq("organization_id", organizationId)
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getDueAutomationRunsGlobally(limit = 100) {
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

const MATERIALIZATION_OUTCOMES = new Set([
  "materialized",
  "already_materialized",
  "claim_lost",
  "not_due",
  "not_found",
  "organization_mismatch",
]);
const FAILURE_SOURCE_STATUSES = new Set(["queued", "processing"]);

export async function materializeAutomationRun({
  id,
  organizationId,
  channel,
  scheduledFor,
  recipientCount,
  payload,
}) {
  const { data, error } = await sb
    .rpc("materialize_automation_run", {
      p_automation_run_id: id,
      p_organization_id: organizationId,
      p_channel: channel,
      p_scheduled_for: scheduledFor,
      p_recipient_count: recipientCount,
      p_payload: payload,
    })
    .single();

  if (error) throw error;

  if (!data || !MATERIALIZATION_OUTCOMES.has(data.outcome)) {
    throw new Error("Invalid materialize_automation_run response");
  }

  return {
    outcome: data.outcome,
    automationRunId: data.run_id ?? id,
    scheduledBroadcastId: data.broadcast_id ?? null,
    runStatus: data.run_status ?? null,
    broadcastStatus: data.broadcast_status ?? null,
  };
}

export async function markAutomationRunProcessing(id, context = {}) {
  if (!context.organizationId || !context.scheduledBroadcastId) {
    throw new Error(
      "markAutomationRunProcessing requires organization and broadcast context",
    );
  }

  let query = sb
    .from("automation_run")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "materialized");

  if (context.organizationId) {
    query = query.eq("organization_id", context.organizationId);
  }
  if (context.scheduledBroadcastId) {
    query = query.eq("scheduled_broadcast_id", context.scheduledBroadcastId);
  }

  const { data, error } = await query.select().maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function markAutomationRunSent(id, context = {}) {
  if (!context.organizationId || !context.scheduledBroadcastId) {
    throw new Error(
      "markAutomationRunSent requires organization and broadcast context",
    );
  }

  let query = sb
    .from("automation_run")
    .update({
      status: "sent",
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "processing");

  if (context.organizationId) {
    query = query.eq("organization_id", context.organizationId);
  }
  if (context.scheduledBroadcastId) {
    query = query.eq("scheduled_broadcast_id", context.scheduledBroadcastId);
  }

  const { data, error } = await query.select().maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function markAutomationRunFailed(
  id,
  lastError = null,
  context = {},
) {
  const expectedStatuses = Array.isArray(context.expectedStatuses)
    ? context.expectedStatuses.filter(Boolean)
    : ["queued"];

  if (!context.organizationId) {
    throw new Error("markAutomationRunFailed requires organization context");
  }
  if (!expectedStatuses.length) {
    throw new Error("markAutomationRunFailed requires an expected status");
  }
  if (expectedStatuses.some((status) => !FAILURE_SOURCE_STATUSES.has(status))) {
    throw new Error("markAutomationRunFailed received an unsafe source status");
  }

  let query = sb
    .from("automation_run")
    .update({
      status: "failed",
      last_error: lastError,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", expectedStatuses);

  if (context.organizationId) {
    query = query.eq("organization_id", context.organizationId);
  }
  if (context.scheduledBroadcastId) {
    query = query.eq("scheduled_broadcast_id", context.scheduledBroadcastId);
  }

  const { data, error } = await query.select().maybeSingle();

  if (error) throw error;
  return data ?? null;
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
