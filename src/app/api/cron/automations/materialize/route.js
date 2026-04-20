import { NextResponse } from "next/server";
import {
  getDueAutomationRuns,
  markAutomationRunFailed,
  markAutomationRunMaterialized,
} from "@/lib/repos/automationRuns.repo";
import { createScheduledBroadcast } from "@/lib/repos/scheduledBroadcasts.repo";
import { getUserById } from "@/lib/repos/user.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return process.env.NODE_ENv !== "production";
  }

  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const xCronSecret = req.headers.get("x-cron-secret") || "";

  return bearer === cronSecret || xCronSecret === cronSecret;
}

function buildWhatsappRecipient(user) {
  if (user?.phone_number) return user.phone_number;

  if (user?.phone_country_code && user?.phone_national) {
    return `${user.phone_country_code}${String(user.phone_national).replace(/\D/g, "")}`;
  }

  return null;
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
      await markAutomationRunFailed(
        run.id,
        "User not found while materializing automation run",
      );
      return {
        id: run.id,
        ok: false,
        error: "User not found",
      };
    }

    const payload = {
      ...(run.payload || {}),
      orgId: run.organization_id,
      automationRunId: run.id,
    };

    if (run.channel === "whatsapp") {
      const recipient = buildWhatsappRecipient(user);

      console.log("[materializeOne] whatsapp recipient", {
        recipient,
      });

      if (!recipient) {
        await markAutomationRunFailed(
          run.id,
          "User has no WhatsApp destination",
        );
        return {
          id: run.id,
          ok: false,
          error: "User has no WhatsApp destination",
        };
      }

      payload.recipients = [recipient];
    } else if (run.channel === "teams") {
      payload.userIds = [user.id];
    } else {
      await markAutomationRunFailed(
        run.id,
        `Unsupported channel: ${run.channel}`,
      );
      return {
        id: run.id,
        ok: false,
        error: `Unsupported channel: ${run.channel}`,
      };
    }

    console.log("[materializeOne] creating scheduled_broadcast", {
      organization_id: run.organization_id,
      channel: run.channel,
      scheduled_for: run.scheduled_for,
      recipient_count: 1,
      payload,
    });

    const broadcast = await createScheduledBroadcast({
      organization_id: run.organization_id,
      channel: run.channel,
      status: "queued",
      scheduled_for: run.scheduled_for,
      recipient_count: 1,
      payload,
    });

    console.log("[materializeOne] scheduled_broadcast created", {
      broadcastId: broadcast?.id,
    });

    await markAutomationRunMaterialized(run.id, broadcast.id);

    console.log("[materializeOne] automation_run marked materialized", {
      runId: run.id,
      broadcastId: broadcast.id,
    });

    return {
      id: run.id,
      ok: true,
      scheduledBroadcastId: broadcast.id,
    };
  } catch (error) {
    console.error("[materializeOne] failed", {
      runId: run.id,
      message: error?.message || String(error),
      error,
    });

    await markAutomationRunFailed(run.id, error?.message || String(error));

    return {
      id: run.id,
      ok: false,
      error: error?.message || String(error),
    };
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
      materialized: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
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
