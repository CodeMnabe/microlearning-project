export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAnalyticsOverview } from "@/lib/services/analytics/analytics.service";

/**
 * Endpoint principal das métricas.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const orgId = Number(searchParams.get("orgId"));
    const period = searchParams.get("period") || "all";

    if (!orgId || Number.isNaN(orgId)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid orgId" },
        { status: 400 }
      );
    }

    const data = await getAnalyticsOverview({
      orgId,
      period,
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("[analytics/overview] error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err.message || "Failed to load analytics overview",
      },
      { status: err.status || 500 }
    );
  }
}