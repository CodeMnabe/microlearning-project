import crypto from "node:crypto";
import {
  IDEMPOTENCY_KEY_MAX_BYTES,
  IDEMPOTENCY_KEY_MIN_LENGTH,
  IMMEDIATE_BROADCAST_RECIPIENT_LIMIT,
  IMMEDIATE_BROADCAST_RESULT_MAX_BYTES,
} from "@/lib/limits/costControls";
import { throwHttpError } from "@/lib/auth/guards";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export function getIdempotencyKey(headers) {
  const value = headers?.get?.("idempotency-key");
  if (typeof value !== "string")
    throwHttpError("Idempotency-Key is required", 400);
  const key = value.trim();
  if (
    key.length < IDEMPOTENCY_KEY_MIN_LENGTH ||
    Buffer.byteLength(key, "utf8") > IDEMPOTENCY_KEY_MAX_BYTES ||
    !IDEMPOTENCY_KEY_PATTERN.test(key)
  ) {
    throwHttpError("Invalid Idempotency-Key", 400);
  }
  return key;
}

export function normalizeImmediateRecipientIds(recipients) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throwHttpError("At least one recipient is required", 422);
  }
  if (recipients.length > IMMEDIATE_BROADCAST_RECIPIENT_LIMIT) {
    throwHttpError("Too many broadcast recipients", 413);
  }
  const seen = new Set();
  const ids = [];
  for (const recipient of recipients) {
    const raw =
      recipient && typeof recipient === "object"
        ? (recipient.userId ?? recipient.id)
        : null;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      throwHttpError("Each recipient must be a valid selected user", 422);
    }
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  if (!ids.length) throwHttpError("At least one recipient is required", 422);
  return ids;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value ?? null;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function createImmediateBroadcastRequestHash({
  organizationId,
  actorUserId,
  channel,
  recipientUserIds,
  payload,
}) {
  const intent = canonicalize({
    organizationId: Number(organizationId),
    actorUserId: String(actorUserId),
    channel,
    recipientUserIds: [...recipientUserIds].sort((a, b) => a - b),
    payload,
  });
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(intent))
    .digest("hex");
}

export async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const run = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = {
          ok: false,
          status: "failed",
          error: error?.message || "Delivery failed",
        };
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, run),
  );
  return results;
}

export function compactProviderResult(result = {}) {
  const compact = {
    ok: Boolean(result.ok),
    status: Number.isInteger(Number(result.status))
      ? Number(result.status)
      : null,
    providerMessageId: result.providerMessageId || null,
    kind: result.kind || null,
  };
  const text = JSON.stringify(compact);
  return Buffer.byteLength(text, "utf8") <= IMMEDIATE_BROADCAST_RESULT_MAX_BYTES
    ? compact
    : { ok: compact.ok, status: compact.status };
}

export function publicImmediateBroadcastResult(row = {}) {
  return {
    requestId: row.request_id || row.id || null,
    channel: row.channel || null,
    status: row.status || null,
    recipientCount: Number(row.recipient_count || 0),
    sent: Number(row.sent_count || 0),
    failed: Number(row.failed_count || 0),
    unknownOutcome: Number(row.unknown_count || 0),
    createdAt: row.created_at || null,
    completedAt: row.completed_at || null,
  };
}
