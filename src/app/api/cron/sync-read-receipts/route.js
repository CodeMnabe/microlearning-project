export const runtime = "nodejs";
import { NextResponse } from "next/server";

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;

  if (!secret) return false;

  const authHeader = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");

  return authHeader === `Bearer ${secret}` || cronHeader === secret;
}

export async function GET(req) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const host = req.headers.get("host");

    if (!host) {
      return NextResponse.json(
        { error: "Missing host header" },
        { status: 500 },
      );
    }

    const protocol = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;

    const res = await fetch(`${baseUrl}/api/messagebird/sync-read-receipts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": process.env.CRON_SECRET,
      },
      body: JSON.stringify({
        limit: 100,
        maxAgeHours: 168,
      }),
      cache: "no-store",
    });

    const result = await res.json().catch(() => null);

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      result,
    });
  } catch (error) {
    console.error("[cron/sync-read-receipts] failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to run read receipt cron",
      },
      {
        status: 500,
      },
    );
  }
}
