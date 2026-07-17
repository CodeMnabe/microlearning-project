import { NextResponse } from "next/server";
import {
  getDueScheduledBroadcasts,
  markScheduledBroadcastProcessing,
  finishScheduledBroadcast,
} from "@/lib/repos/scheduledBroadcasts.repo";
import {
  getAutomationRunForScheduledBroadcast,
  markAutomationRunFailed,
  markAutomationRunProcessing,
  markAutomationRunSent,
} from "@/lib/repos/automationRuns.repo";
import { sendTeamsBroadcast } from "@/lib/services/broadcast/sendTeamsBroadcast";
import { sendWhatsappBroadcast } from "@/lib/services/broadcast/sendWhatsappBroadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return false;
  }

  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const xCronSecret = req.headers.get("x-cron-secret") || "";

  return bearer === cronSecret || xCronSecret === cronSecret;
}

async function syncAutomationRunProcessing(automationRunId, context) {
  if (!automationRunId) return null;

  try {
    const claimed = await markAutomationRunProcessing(automationRunId, context);

    if (claimed === null) {
      console.warn("[Automations] Automation run claim was lost", {
        automationRunId,
        scheduledBroadcastId: context.scheduledBroadcastId,
      });
    }

    return claimed;
  } catch (error) {
    console.warn("[Automations] Failed to mark run processing", {
      automationRunId,
      message: error?.message || String(error),
    });
    throw error;
  }
}

async function syncAutomationRunSuccess(automationRunId, context) {
  if (!automationRunId) return null;

  try {
    const sentRun = await markAutomationRunSent(automationRunId, context);

    if (sentRun === null) {
      console.warn("[Automations] Run sent transition lost ownership", {
        automationRunId,
        scheduledBroadcastId: context.scheduledBroadcastId,
      });
    }

    return sentRun;
  } catch (error) {
    console.warn("[Automations] Failed to mark run sent", {
      automationRunId,
      message: error?.message || String(error),
    });
    return null;
  }
}

async function syncAutomationRunFailure(
  automationRunId,
  errorMessage,
  context,
) {
  if (!automationRunId) return null;

  try {
    const failedRun = await markAutomationRunFailed(
      automationRunId,
      errorMessage,
      {
        ...context,
        expectedStatuses: ["processing"],
      },
    );

    if (failedRun === null) {
      console.warn("[Automations] Run failed transition lost ownership", {
        automationRunId,
        scheduledBroadcastId: context.scheduledBroadcastId,
      });
    }

    return failedRun;
  } catch (error) {
    console.warn("[Automations] Failed to mark run failed", {
      automationRunId,
      message: error?.message || String(error),
    });
    return null;
  }
}

function normalizeError(err) {
  if (!err) return "Unknown error";

  if (typeof err === "string") return err;
  if (typeof err?.message === "string" && err.message !== "[object Object]") {
    return err.message;
  }
  if (typeof err?.error === "string") return err.error;
  if (typeof err?.data?.error === "string") return err.data.error;

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function processOneBroadcast(broadcast) {
  let locked;
  const structuralAutomationRunId = broadcast?.automation_run_id || null;
  const payloadAutomationRunId = broadcast?.payload?.automationRunId || null;
  const automationRunId =
    structuralAutomationRunId || payloadAutomationRunId || null;
  let verifiedAutomationRunId = null;
  const automationContext = {
    organizationId: broadcast.organization_id,
    scheduledBroadcastId: broadcast.id,
  };

  try {
    locked = await markScheduledBroadcastProcessing(broadcast.id);
  } catch (err) {
    return {
      id: broadcast.id,
      ok: false,
      skipped: true,
      error: normalizeError(err),
    };
  }

  if (!locked) {
    return {
      id: broadcast.id,
      ok: false,
      skipped: true,
      error: "Could not lock broadcast for processing",
    };
  }

  try {
    if (
      structuralAutomationRunId &&
      payloadAutomationRunId &&
      String(structuralAutomationRunId) !== String(payloadAutomationRunId)
    ) {
      throw new Error(
        "Scheduled broadcast automation origin does not match its payload",
      );
    }

    if (automationRunId) {
      const automationRun = await getAutomationRunForScheduledBroadcast({
        id: automationRunId,
        ...automationContext,
      });

      if (!automationRun) {
        throw new Error(
          "Automation run does not belong to this scheduled broadcast",
        );
      }

      const claimedAutomationRun = await syncAutomationRunProcessing(
        automationRun.id,
        automationContext,
      );

      if (claimedAutomationRun === null) {
        throw new Error("Could not claim automation run for processing");
      }

      verifiedAutomationRunId = claimedAutomationRun.id;
    }

    const storedPayload = broadcast.payload || {};
    const payload = {
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

    console.log("[Schedule Broadcast] payload before send", {
      broadcastId: broadcast.id,
      channel: broadcast.channel,
      payload,
    });

    let result;

    if (broadcast.channel === "whatsapp") {
      result = await sendWhatsappBroadcast(payload);
    } else if (broadcast.channel === "teams") {
      result = await sendTeamsBroadcast(payload);
    } else {
      throw new Error(`Unsupported channel: ${broadcast.channel}`);
    }

    const okCount = Number(result?.ok || 0);
    const failedCount = Number(result?.failed || 0);

    let finalStatus = "sent";
    if (okCount > 0 && failedCount > 0) finalStatus = "partial";
    if (okCount === 0 && failedCount > 0) finalStatus = "failed";

    await finishScheduledBroadcast(broadcast.id, {
      status: finalStatus,
    });

    if (finalStatus === "failed") {
      await syncAutomationRunFailure(
        verifiedAutomationRunId,
        JSON.stringify(result?.results || result || {}),
        automationContext,
      );
    } else {
      await syncAutomationRunSuccess(
        verifiedAutomationRunId,
        automationContext,
      );
    }

    return {
      id: broadcast.id,
      ok: finalStatus !== "failed",
      status: finalStatus,
      result,
    };
  } catch (err) {
    console.error("[Schedule Broadcast] processOneBroadcast failed", {
      broadcastId: broadcast.id,
      channel: broadcast.channel,
      payload: broadcast.payload,
      err,
      message: err?.message,
      stack: err?.stack,
    });

    try {
      await finishScheduledBroadcast(broadcast.id, { status: "failed" });
    } catch (finishErr) {
      console.error(
        `[Schedule Broadcast] Failed to mark ${broadcast.id} as failed:`,
        finishErr,
      );
    }

    const normalizedError = normalizeError(err);

    await syncAutomationRunFailure(
      verifiedAutomationRunId,
      normalizedError,
      automationContext,
    );

    return {
      id: broadcast.id,
      ok: false,
      status: "failed",
      error: normalizedError,
    };
  }
}

async function handler(req) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let limit = 500;

    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (body?.limit) limit = Number(body.limit) || 500;
      } else {
        const url = new URL(req.url);
        const rawLimit = url.searchParams.get("limit");
        if (rawLimit) limit = Number(rawLimit) || 500;
      }
    } catch {
      // keep default
    }

    const due = await getDueScheduledBroadcasts(limit);

    if (!due.length) {
      return NextResponse.json({
        ok: true,
        message: "No schedule broadcasts due",
        processed: 0,
        results: [],
      });
    }

    const results = [];
    for (const broadcast of due) {
      const result = await processOneBroadcast(broadcast);
      results.push(result);
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      sent: results.filter((r) => r.status === "sent").length,
      partial: results.filter((r) => r.status === "partial").length,
      failed: results.filter((r) => r.status === "failed").length,
      skipped: results.filter((r) => r.skipped).length,
      results,
    });
  } catch (err) {
    console.error("[Schedule Broadcast] Cron error:", err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  return handler(req);
}

export async function POST(req) {
  return handler(req);
}
