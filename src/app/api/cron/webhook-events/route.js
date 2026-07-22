import { NextResponse } from "next/server";
import { processWebhookEventBatch } from "@/lib/webhooks/eventWorker";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = req.headers.get("authorization") || "";
  const bearer = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  return bearer === secret || req.headers.get("x-cron-secret") === secret;
}

async function handler(req) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") || 25);
    const result = await processWebhookEventBatch({ limit });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error(
      "webhook_processing_failed",
      {
        provider: "internal",
        operation: "webhook_event_batch",
        outcome: "failed",
      },
      error,
    );
    return NextResponse.json(
      { ok: false, error: "Webhook event worker failed" },
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
