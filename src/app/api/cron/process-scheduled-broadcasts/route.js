import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  claimDueScheduledBroadcasts,
  completeScheduledBroadcast,
  maintainScheduledBroadcastLifecycle,
  markScheduledBroadcastSendStarted,
  renewScheduledBroadcastLease,
} from "@/lib/repos/scheduledBroadcasts.repo";
import { sendTeamsBroadcast } from "@/lib/services/broadcast/sendTeamsBroadcast";
import { sendWhatsappBroadcast } from "@/lib/services/broadcast/sendWhatsappBroadcast";
import { startLeaseHeartbeat } from "@/lib/webhooks/leaseHeartbeat";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEASE_SECONDS = 120;
const MAX_ATTEMPTS = 3;

function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  return (
    bearer === cronSecret || req.headers.get("x-cron-secret") === cronSecret
  );
}

function normalizeError(error) {
  if (typeof error?.message === "string") return error.message;
  return String(error || "Unknown error");
}

function compactProviderResult(result) {
  return {
    ok: Number(result?.ok || 0),
    failed: Number(result?.failed || 0),
    recipients: Array.isArray(result?.results)
      ? result.results.map((entry) => ({
          userId: entry?.userId ?? null,
          ok: Boolean(entry?.ok),
          status: Number.isFinite(Number(entry?.status))
            ? Number(entry.status)
            : null,
          providerMessageId: entry?.providerMessageId ?? null,
        }))
      : [],
  };
}

function buildPayload(broadcast) {
  const storedPayload = broadcast.payload || {};
  return {
    orgId: broadcast.organization_id,
    message: storedPayload.message || "",
    files: Array.isArray(storedPayload.files) ? storedPayload.files : [],
    imageUrls: Array.isArray(storedPayload.imageUrls)
      ? storedPayload.imageUrls
      : [],
    trackedLinks: Array.isArray(storedPayload.trackedLinks)
      ? storedPayload.trackedLinks
      : [],
    scheduledBroadcastId: broadcast.id,
    createdByUserId: null,
    ...(broadcast.channel === "whatsapp"
      ? {
          recipients: Array.isArray(storedPayload.recipients)
            ? storedPayload.recipients
            : [],
          template: storedPayload.template || null,
          whatsappTemplateId: storedPayload.whatsappTemplateId || null,
          chainMetadata: null,
        }
      : {
          userIds: Array.isArray(storedPayload.userIds)
            ? storedPayload.userIds
            : [],
        }),
  };
}

async function processOneBroadcast(broadcast) {
  const context = {
    id: broadcast.id,
    organizationId: broadcast.organization_id,
    claimToken: broadcast.claim_token,
    workerId: broadcast.worker_id,
  };
  let sendStarted = false;
  const heartbeat = startLeaseHeartbeat({
    label: `scheduled broadcast ${broadcast.id}`,
    leaseSeconds: LEASE_SECONDS,
    renew: () =>
      renewScheduledBroadcastLease({
        ...context,
        leaseSeconds: LEASE_SECONDS,
      }),
  });

  try {
    await heartbeat.renewNow();
    const started = await markScheduledBroadcastSendStarted(context);
    if (!started) {
      return {
        id: broadcast.id,
        ok: false,
        skipped: true,
        error: "Claim lost before send",
      };
    }
    sendStarted = true;
    heartbeat.assertOwned();

    const payload = buildPayload(broadcast);
    const result =
      broadcast.channel === "whatsapp"
        ? await sendWhatsappBroadcast(payload)
        : broadcast.channel === "teams"
          ? await sendTeamsBroadcast(payload)
          : (() => {
              throw new Error(`Unsupported channel: ${broadcast.channel}`);
            })();
    heartbeat.assertOwned();

    const providerResult = compactProviderResult(result);
    const outcome =
      providerResult.ok > 0 && providerResult.failed > 0
        ? "partial"
        : providerResult.ok > 0
          ? "sent"
          : "unknown_outcome";
    const finished = await completeScheduledBroadcast({
      ...context,
      outcome,
      providerResult,
      maxAttempts: MAX_ATTEMPTS,
      lastError:
        outcome === "unknown_outcome"
          ? "Provider did not confirm a successful scheduled broadcast send"
          : null,
    });
    if (!finished) {
      throw new Error("Scheduled broadcast claim was lost before finalization");
    }
    logger.info("scheduled_broadcast_processed", {
      provider: broadcast.channel === "whatsapp" ? "bird" : "teams",
      operation: "scheduled_broadcast_send",
      outcome,
      broadcastId: broadcast.id,
      organizationId: broadcast.organization_id,
      succeeded: providerResult.ok,
      failed: providerResult.failed,
    });
    return {
      id: broadcast.id,
      ok: outcome !== "unknown_outcome",
      status: outcome,
    };
  } catch (error) {
    const message = normalizeError(error);
    logger.error(
      "scheduled_broadcast_delivery_failed",
      {
        provider: broadcast.channel === "whatsapp" ? "bird" : "teams",
        operation: "scheduled_broadcast_send",
        outcome: sendStarted ? "unknown_outcome" : "retryable_failed",
        broadcastId: broadcast.id,
        organizationId: broadcast.organization_id,
        externalRequestStarted: sendStarted,
      },
      error,
    );
    try {
      await completeScheduledBroadcast({
        ...context,
        outcome: sendStarted ? "unknown_outcome" : "retryable_failed",
        lastError: message,
        maxAttempts: MAX_ATTEMPTS,
      });
    } catch (finalizationError) {
      logger.error(
        "scheduled_broadcast_finalization_failed",
        {
          provider: "supabase",
          operation: "scheduled_broadcast_finalization",
          outcome: "failed",
          broadcastId: broadcast.id,
          organizationId: broadcast.organization_id,
        },
        finalizationError,
      );
    }
    return {
      id: broadcast.id,
      ok: false,
      status: sendStarted ? "unknown_outcome" : "retryable_failed",
      error: message,
    };
  } finally {
    await heartbeat.stop();
  }
}

async function handler(req) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let limit = 100;
    try {
      const body =
        req.method === "POST" ? await req.json().catch(() => ({})) : {};
      const rawLimit =
        body?.limit ?? new URL(req.url).searchParams.get("limit");
      if (rawLimit) limit = Math.min(500, Math.max(1, Number(rawLimit) || 100));
    } catch {}

    const maintenance = await maintainScheduledBroadcastLifecycle({
      limit,
      maxAttempts: MAX_ATTEMPTS,
    });
    const workerId = `scheduled-broadcast:${randomUUID()}`;
    const claimed = await claimDueScheduledBroadcasts({
      workerId,
      limit,
      leaseSeconds: LEASE_SECONDS,
      maxAttempts: MAX_ATTEMPTS,
    });
    const results = [];
    for (const broadcast of claimed)
      results.push(await processOneBroadcast(broadcast));

    logger.info("scheduled_broadcast_batch_completed", {
      provider: "internal",
      operation: "scheduled_broadcast_batch",
      outcome: "completed",
      claimed: claimed.length,
      sent: results.filter((item) => item.status === "sent").length,
      partial: results.filter((item) => item.status === "partial").length,
      retryableFailed: results.filter(
        (item) => item.status === "retryable_failed",
      ).length,
      unknownOutcome: results.filter(
        (item) => item.status === "unknown_outcome",
      ).length,
    });

    return NextResponse.json({
      ok: true,
      maintenance,
      claimed: claimed.length,
      sent: results.filter((item) => item.status === "sent").length,
      partial: results.filter((item) => item.status === "partial").length,
      retryableFailed: results.filter(
        (item) => item.status === "retryable_failed",
      ).length,
      unknownOutcome: results.filter(
        (item) => item.status === "unknown_outcome",
      ).length,
      results,
    });
  } catch (error) {
    logger.error(
      "scheduled_broadcast_processing_failed",
      {
        provider: "internal",
        operation: "scheduled_broadcast_batch",
        outcome: "failed",
      },
      error,
    );
    return NextResponse.json({ error: normalizeError(error) }, { status: 500 });
  }
}

export async function GET(req) {
  return handler(req);
}

export async function POST(req) {
  return handler(req);
}
