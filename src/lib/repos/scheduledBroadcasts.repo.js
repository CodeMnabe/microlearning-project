import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const BROWSER_SCHEDULED_BROADCAST_COLUMNS = [
  "id",
  "channel",
  "status",
  "scheduled_for",
  "timezone",
  "payload",
  "recipient_count",
  "created_at",
  "updated_at",
  "created_by_user_id",
  "started_at",
  "completed_at",
  "cancelled_at",
].join(", ");

export function toBrowserScheduledBroadcast(row) {
  if (!row) return null;

  const result = {};

  for (const column of BROWSER_SCHEDULED_BROADCAST_COLUMNS.split(", ")) {
    if (Object.prototype.hasOwnProperty.call(row, column)) {
      result[column] = row[column];
    }
  }

  return result;
}

export async function createScheduledBroadcast(row) {
  const { data, error } = await sb
    .from("scheduled_broadcast")
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getScheduledBroadcastByAutomationRunId(automationRunId) {
  if (!automationRunId) return null;

  const { data, error } = await sb
    .from("scheduled_broadcast")
    .select("*")
    .eq("automation_run_id", automationRunId)
    .maybeSingle();

  if (error) throw error;
  if (data === null) return null;
  return data;
}

export async function getOrgScheduledBroadcasts(
  organizationId,
  { source = "all" } = {},
) {
  const { data, error } = await sb
    .from("scheduled_broadcast")
    .select(BROWSER_SCHEDULED_BROADCAST_COLUMNS)
    .eq("organization_id", organizationId)
    .order("scheduled_for", { ascending: true });

  if (error) throw error;

  const rows = data || [];

  function isAutomationBroadcast(broadcast) {
    const payload = broadcast?.payload;

    if (!payload || typeof payload !== "object") {
      return false;
    }

    return Boolean(
      payload._automation ||
      payload.automationRunId ||
      payload.automationRuleId ||
      payload.ruleId ||
      payload.source === "automation",
    );
  }

  if (source === "automation") {
    return rows.filter(isAutomationBroadcast).map(toBrowserScheduledBroadcast);
  }

  if (source === "manual") {
    return rows
      .filter((broadcast) => !isAutomationBroadcast(broadcast))
      .map(toBrowserScheduledBroadcast);
  }

  return rows.map(toBrowserScheduledBroadcast);
}

async function rpcMaybeSingle(name, args) {
  const { data, error } = await sb.rpc(name, args).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function editScheduledBroadcast({
  id,
  organizationId,
  actorUserId,
  scheduledFor = null,
  timezone = null,
  expectedUpdatedAt,
}) {
  return rpcMaybeSingle("edit_scheduled_broadcast", {
    p_scheduled_broadcast_id: id,
    p_organization_id: organizationId,
    p_actor_user_id: actorUserId,
    p_scheduled_for: scheduledFor,
    p_timezone: timezone,
    p_expected_updated_at: expectedUpdatedAt,
  });
}

export async function cancelScheduledBroadcast({
  id,
  organizationId,
  cancelledByUserId = null,
  reason = null,
}) {
  return rpcMaybeSingle("cancel_scheduled_broadcast", {
    p_scheduled_broadcast_id: id,
    p_organization_id: organizationId,
    p_cancelled_by_user_id: cancelledByUserId,
    p_reason: reason,
  });
}

export async function maintainScheduledBroadcastLifecycle({
  limit = 100,
  maxAttempts = 3,
} = {}) {
  const { data, error } = await sb.rpc(
    "maintain_scheduled_broadcast_lifecycle",
    {
      p_limit: limit,
      p_max_attempts: maxAttempts,
    },
  );
  if (error) throw error;
  return (
    data?.[0] ?? {
      retryable_failed_count: 0,
      failed_count: 0,
      unknown_outcome_count: 0,
    }
  );
}

export async function claimDueScheduledBroadcasts({
  workerId,
  limit = 100,
  leaseSeconds = 120,
  maxAttempts = 3,
}) {
  const { data, error } = await sb.rpc("claim_due_scheduled_broadcasts", {
    p_worker_id: workerId,
    p_limit: limit,
    p_lease_seconds: leaseSeconds,
    p_max_attempts: maxAttempts,
  });
  if (error) throw error;
  return data || [];
}

export async function renewScheduledBroadcastLease({
  id,
  organizationId,
  claimToken,
  workerId,
  leaseSeconds = 120,
}) {
  return rpcMaybeSingle("renew_scheduled_broadcast_lease", {
    p_scheduled_broadcast_id: id,
    p_organization_id: organizationId,
    p_claim_token: claimToken,
    p_worker_id: workerId,
    p_lease_seconds: leaseSeconds,
  });
}

export async function markScheduledBroadcastSendStarted({
  id,
  organizationId,
  claimToken,
  workerId,
}) {
  return rpcMaybeSingle("mark_scheduled_broadcast_send_started", {
    p_scheduled_broadcast_id: id,
    p_organization_id: organizationId,
    p_claim_token: claimToken,
    p_worker_id: workerId,
  });
}

export async function completeScheduledBroadcast({
  id,
  organizationId,
  claimToken,
  workerId,
  outcome,
  providerResult = null,
  lastError = null,
  maxAttempts = 3,
}) {
  return rpcMaybeSingle("complete_scheduled_broadcast", {
    p_scheduled_broadcast_id: id,
    p_organization_id: organizationId,
    p_claim_token: claimToken,
    p_worker_id: workerId,
    p_outcome: outcome,
    p_provider_result: providerResult,
    p_last_error: lastError,
    p_max_attempts: maxAttempts,
  });
}
