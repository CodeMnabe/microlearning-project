export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;

  if (!secret) return false;

  const authHeader = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");

  return authHeader === `Bearer ${secret}` || cronHeader === secret;
}

function getInternalBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!configuredUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is not configured");
  }

  const url = new URL(configuredUrl);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTP or HTTPS");
  }

  if (
    process.env.NODE_ENV === "production" &&
    url.protocol !== "https:"
  ) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must use HTTPS in production",
    );
  }

  return url.origin;
}

export async function GET(req) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const baseUrl = getInternalBaseUrl();

    const res = await fetch(
      `${baseUrl}/api/messagebird/sync-read-receipts`,
      {
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
      },
    );

    const result = await res.json().catch(() => null);

    return NextResponse.json(
      {
        ok: res.ok,
        status: res.status,
        result,
      },
      {
        status: res.status,
      },
    );
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