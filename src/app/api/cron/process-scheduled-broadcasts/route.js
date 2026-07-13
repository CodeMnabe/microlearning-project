import { NextResponse } from "next/server";
import { processScheduledBroadcasts } from "@/lib/services/broadcast/scheduledBroadcasts/scheduledBroadcasts.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) return process.env.NODE_ENV !== "production";

  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const xCronSecret = req.headers.get("x-cron-secret") || "";

  return bearer === cronSecret || xCronSecret === cronSecret;
}

async function getRequestedLimit(req) {
  let limit = 500;

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.limit) limit = Number(body.limit) || 500;
    } else {
      const rawLimit = new URL(req.url).searchParams.get("limit");
      if (rawLimit) limit = Number(rawLimit) || 500;
    }
  } catch {}

  return limit;
}

async function handler(req) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      await processScheduledBroadcasts({ limit: await getRequestedLimit(req) })
    );
  } catch (error) {
    console.error("[Schedule Broadcast] Cron error:", error);
    return NextResponse.json(
      { error: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  return handler(req);
}

export async function POST(req) {
  return handler(req);
}
