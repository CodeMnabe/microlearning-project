import { NextResponse } from "next/server";
import { cleanupPublicAbuseData } from "@/lib/repos/trackedLinks.repo";
import { PUBLIC_ABUSE_CLEANUP_MAX_BATCH } from "@/lib/limits/publicAbuse";
import { logger } from "@/lib/observability/logger";

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authorization = request.headers.get("authorization") || "";
  return (
    authorization === `Bearer ${secret}` ||
    request.headers.get("x-cron-secret") === secret
  );
}

function boundedInteger(name, minimum, maximum) {
  const value = Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} is missing or invalid`);
  }
  return value;
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await cleanupPublicAbuseData({
      batchSize: boundedInteger(
        "PUBLIC_ABUSE_CLEANUP_BATCH_SIZE",
        1,
        PUBLIC_ABUSE_CLEANUP_MAX_BATCH,
      ),
      eventRetentionDays: boundedInteger(
        "TRACKED_LINK_EVENT_RETENTION_DAYS",
        1,
        3650,
      ),
      expiredLinkGraceDays: boundedInteger(
        "TRACKED_LINK_EXPIRED_LINK_GRACE_DAYS",
        1,
        365,
      ),
    });
    const processed =
      Number(result?.capacity_buckets_deleted || 0) +
      Number(result?.contact_dedupe_deleted || 0) +
      Number(result?.events_deleted || 0) +
      Number(result?.links_deleted || 0);
    logger.info("public_abuse_cleanup_completed", {
      provider: "supabase",
      operation: "public_abuse_cleanup",
      outcome: "completed",
      processed,
    });
    return NextResponse.json({ ok: true, processed });
  } catch (error) {
    logger.error(
      "public_abuse_cleanup_failed",
      {
        provider: "supabase",
        operation: "public_abuse_cleanup",
        outcome: "failed",
      },
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
