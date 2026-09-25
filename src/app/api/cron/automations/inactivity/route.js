import { NextResponse } from "next/server";
import { runInactivityScan } from "@/lib/services/automations/inactivityScan";

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

    let limitOrganizations = null;

    try {
      const url = new URL(req.url);
      const raw = url.searchParams.get("organizationId");
      if (raw) {
        limitOrganizations = Number(raw);
      }
    } catch {
      // ignore this error
    }

    const result = await runInactivityScan({ organizationId: limitOrganizations || null });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Automations][Inactivity]", error);
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
