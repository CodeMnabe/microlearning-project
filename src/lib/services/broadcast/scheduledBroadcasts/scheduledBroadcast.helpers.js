/** Pure helpers for Scheduled Broadcast services. */

export const SCHEDULED_BROADCAST_CHANNELS = new Set(["teams", "whatsapp"]);
export const SCHEDULED_BROADCAST_SOURCES = new Set([
  "all",
  "manual",
  "automation",
]);
export const ALLOWED_SCHEDULED_BROADCAST_PATCH_FIELDS = new Set([
  "channel",
  "scheduled_for",
  "timezone",
  "status",
  "payload",
  "recipient_count",
]);

export function parseScheduledFor(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

export function normalizeScheduledBroadcastSource(source) {
  return SCHEDULED_BROADCAST_SOURCES.has(source) ? source : "all";
}

export function pickScheduledBroadcastPatch(body) {
  return Object.fromEntries(
    Object.entries(body || {}).filter(([key]) =>
      ALLOWED_SCHEDULED_BROADCAST_PATCH_FIELDS.has(key)
    )
  );
}

export function buildScheduledBroadcastRow({
  orgId,
  createdByUserId,
  channel,
  scheduledFor,
  timezone,
  payload,
  recipientCount,
}) {
  return {
    organization_id: orgId,
    created_by_user_id: createdByUserId,
    channel,
    status: "queued",
    scheduled_for: scheduledFor.toISOString(),
    timezone: timezone || null,
    payload: { ...payload },
    recipient_count: Number(recipientCount || 0),
  };
}

export function normalizeScheduledBroadcastError(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (typeof error?.message === "string" && error.message !== "[object Object]") {
    return error.message;
  }
  if (typeof error?.error === "string") return error.error;
  if (typeof error?.data?.error === "string") return error.data.error;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function getScheduledBroadcastFinalStatus(result) {
  const okCount = Number(result?.ok || 0);
  const failedCount = Number(result?.failed || 0);

  if (okCount === 0 && failedCount > 0) return "failed";
  if (okCount > 0 && failedCount > 0) return "partial";
  return "sent";
}

export function buildScheduledBroadcastSendPayload(broadcast) {
  const { createdByUserId: _ignoredCreatedByUserId, ...safeStoredPayload } =
    broadcast.payload || {};

  return {
    ...safeStoredPayload,
    orgId: safeStoredPayload.orgId || broadcast.organization_id,
    scheduledBroadcastId: broadcast.id,
  };
}
