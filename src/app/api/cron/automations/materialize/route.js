import { NextResponse } from "next/server";
import { materializeDueRuns } from "@/lib/services/automations/materializeRuns";

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

    const result = await materializeDueRuns({ limit });
    return NextResponse.json(result);
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
