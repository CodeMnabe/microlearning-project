import { NextResponse } from "next/server";
import {
  getDueScheduledBroadcasts,
  markScheduledBroadcastProcessing,
  finishScheduledBroadcast,
} from "@/lib/repos/scheduledBroadcasts.repo";
import {
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
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const xCronSecret = req.headers.get("x-cron-secret") || "";

  return bearer === cronSecret || xCronSecret === cronSecret;
}

async function syncAutomationRunProcessing(automationRunId) {
  if (!automationRunId) return;

  try {
    await markAutomationRunProcessing(automationRunId);
  } catch (error) {
    console.warn("[Automations] Failed to mark run processing", {
      automationRunId,
      message: error?.message || String(error),
    });
  }
}

async function syncAutomationRunSuccess(automationRunId) {
  if (!automationRunId) return;

  try {
    await markAutomationRunSent(automationRunId);
  } catch (error) {
    console.warn("[Automations] Failed to mark run sent", {
      automationRunId,
      message: error?.message || String(error),
    });
  }
}

async function syncAutomationRunFailure(automationRunId, errorMessage) {
  if (!automationRunId) return;

  try {
  } catch (error) {
    console.warn("[AUtomations] Failed to mark run failed", {
      automationRunId,
      message: error?.message || String(error),
    });
  }
}

async function processOneBroadcast(broadcast) {
  let locked;
  const automationRunId = broadcast?.payload?.automationRunId || null;

  try {
    locked = await markScheduledBroadcastProcessing(broadcast.id);
  } catch (err) {
    return {
      id: broadcast.id,
      ok: false,
      skipped: true,
      error: err.message || String(err),
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

  await syncAutomationRunProcessing(automationRunId);

  try {
    const payload = {
      ...(broadcast.payload || {}),
      orgId: broadcast.payload?.orgId || broadcast.organization_id,
    };

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
        automationRunId,
        JSON.stringify(result?.results || result || {}),
      );
    } else {
      await syncAutomationRunSuccess(automationRunId);
    }

    return {
      id: broadcast.id,
      ok: finalStatus !== "failed",
      status: finalStatus,
      result,
    };
  } catch (err) {
    try {
      await finishScheduledBroadcast(broadcast.id, { status: "failed" });
    } catch (finishErr) {
      console.error(
        `[Schedule Broadcast] Failed to mark ${broadcast.id} as failed:`,
        finishErr,
      );
    }

    await syncAutomationRunFailure(automationRunId, err.message || String(err));

    return {
      id: broadcast.id,
      ok: false,
      status: "failed",
      error: err.message || String(err),
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
      //ignore bad limit parsing and keep default catch
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
    console.error("[Schedule Broadcast] Cron error: ", err);
    return NextResponse.json(
      { error: err.message || String(err) },
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
