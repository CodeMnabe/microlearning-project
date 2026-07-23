import "server-only";
import { getSupabaseAdminClient } from "@/lib/db/admin";

export async function consumeRequestCapacity({
  scope,
  subjectHash,
  windowSeconds,
  maximumRequests,
}) {
  const { data, error } = await getSupabaseAdminClient().rpc(
    "consume_request_capacity",
    {
      p_scope: scope,
      p_subject_hash: subjectHash,
      p_window_seconds: windowSeconds,
      p_maximum_requests: maximumRequests,
    },
  );
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.accepted !== "boolean") {
    throw new Error("Request capacity response is invalid");
  }
  return {
    accepted: row.accepted,
    remaining: Number(row.remaining),
    retryAfterSeconds: Math.max(1, Number(row.retry_after_seconds) || 1),
  };
}

export async function consumeCapacitySet(entries) {
  let retryAfterSeconds = 1;
  for (const entry of entries) {
    const result = await consumeRequestCapacity(entry);
    if (!result.accepted) {
      retryAfterSeconds = Math.max(retryAfterSeconds, result.retryAfterSeconds);
      return { accepted: false, retryAfterSeconds };
    }
  }
  return { accepted: true, retryAfterSeconds: 0 };
}
