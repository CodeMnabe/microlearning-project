import { NextResponse } from "next/server";
import {
  getDueAutomationRuns,
  materializeAutomationRun,
  markAutomationRunFailed,
} from "@/lib/repos/automationRuns.repo";
import { getUserById } from "@/lib/repos/user.repo";

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

function skippedResult(run, outcome, scheduledBroadcastId = null) {
  return {
    id: run.id,
    ok: true,
    skipped: true,
    outcome,
    scheduledBroadcastId,
  };
}

async function recordQueuedFailure(run, message, publicMessage = message) {
  try {
    const failedRun = await markAutomationRunFailed(run.id, message, {
      organizationId: run.organization_id,
      expectedStatuses: ["queued"],
    });

    if (failedRun === null) {
      return skippedResult(run, "claim_lost");
    }

    return {
      id: run.id,
      ok: false,
      outcome: "failed",
      error: publicMessage,
    };
  } catch (failureError) {
    console.error("[materializeOne] failed to record queued failure", {
      runId: run.id,
      message: failureError?.message || String(failureError),
    });

    return {
      id: run.id,
      ok: false,
      outcome: "failed",
      error: publicMessage,
      stateUpdateError: failureError?.message || String(failureError),
    };
  }
}

async function materializeOne(run) {
  try {
    console.log("[materializeOne] start", {
      runId: run.id,
      userId: run.user_id,
      channel: run.channel,
      scheduledFor: run.scheduled_for,
    });

    const user = await getUserById(run.user_id);

    console.log("[materializeOne] user", {
      found: Boolean(user),
      userId: user?.id,
      phone: user?.phone_number,
      assistantId: user?.assistant_id,
    });

    if (!user) {
      return recordQueuedFailure(
        run,
        "User not found while materializing automation run",
        "User not found",
      );
    }

    if (Number(user.organization_id) !== Number(run.organization_id)) {
      return recordQueuedFailure(
        run,
        "User does not belong to automation run organization",
        "User does not belong to automation run organization",
      );
    }

    const payload = {
      ...(run.payload || {}),
      orgId: run.organization_id,
      automationRunId: run.id,
    };

    if (run.channel === "whatsapp") {
      const recipient = { userId: user.id };

      console.log("[materializeOne] whatsapp recipient", {
        recipient,
      });

      payload.recipients = [recipient];
    } else if (run.channel === "teams") {
      payload.userIds = [user.id];
    } else {
      return recordQueuedFailure(
        run,
        `Unsupported channel: ${run.channel}`,
        `Unsupported channel: ${run.channel}`,
      );
    }

    console.log("[materializeOne] materializing atomically", {
      runId: run.id,
      organization_id: run.organization_id,
      channel: run.channel,
      scheduled_for: run.scheduled_for,
      recipient_count: 1,
      payload,
    });

    const result = await materializeAutomationRun({
      id: run.id,
      organizationId: run.organization_id,
      channel: run.channel,
      scheduledFor: run.scheduled_for,
      recipientCount: 1,
      payload,
    });

    if (result.outcome !== "materialized") {
      console.log("[materializeOne] skipped", {
        runId: run.id,
        outcome: result.outcome,
        broadcastId: result.scheduledBroadcastId,
      });
      return skippedResult(run, result.outcome, result.scheduledBroadcastId);
    }

    return {
      id: run.id,
      ok: true,
      outcome: "materialized",
      scheduledBroadcastId: result.scheduledBroadcastId,
    };
  } catch (error) {
    console.error("[materializeOne] failed", {
      runId: run.id,
      message: error?.message || String(error),
      error,
    });

    return recordQueuedFailure(run, error?.message || String(error));
  }
}

async function handler(req) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let limit = 200;

    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (body?.limit) limit = Number(body.limit) || 200;
      } else {
        const url = new URL(req.url);
        const rawLimit = url.searchParams.get("limit");
        if (rawLimit) limit = Number(rawLimit) || 200;
      }
    } catch {}

    console.log("[materialize] now:", new Date().toISOString());
    const dueRuns = await getDueAutomationRuns(limit);
    console.log(
      "[materialize] dueRuns:",
      dueRuns.map((r) => ({
        id: r.id,
        status: r.status,
        scheduled_for: r.scheduled_for,
      })),
    );

    if (!dueRuns.length) {
      return NextResponse.json({
        ok: true,
        message: "No automation runs due",
        processed: 0,
        materialized: 0,
        skipped: 0,
        claimLost: 0,
        failed: 0,
        results: [],
      });
    }

    const results = [];

    for (const run of dueRuns) {
      console.log("[materialize] loop run", run.id);
      results.push(await materializeOne(run));
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      materialized: results.filter((r) => r.outcome === "materialized").length,
      skipped: results.filter((r) => r.skipped).length,
      claimLost: results.filter((r) => r.outcome === "claim_lost").length,
      failed: results.filter((r) => r.outcome === "failed").length,
      results,
    });
  } catch (error) {
    console.error("[Automations][Materialize]", error);
    return NextResponse.json(
      { error: error?.message || String(error) },
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
