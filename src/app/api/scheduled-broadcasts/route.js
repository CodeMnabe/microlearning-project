import { NextResponse } from "next/server";
import { getOrgScheduledBroadcasts } from "@/lib/repos/scheduledBroadcasts.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SOURCES = new Set(["all", "manual", "automation"]);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const orgIdRaw = searchParams.get("orgId");
    const sourceRaw = searchParams.get("source") || "all";

    const orgId = Number(orgIdRaw);
    const source = ALLOWED_SOURCES.has(sourceRaw) ? sourceRaw : "all";

    if (!orgIdRaw || Number.isNaN(orgId)) {
      return NextResponse.json(
        { error: "orgId is required." },
        { status: 400 },
      );
    }

    const data = await getOrgScheduledBroadcasts(orgId, { source });

    return NextResponse.json({ items: data });
  } catch (err) {
    console.error("GET /api/scheduled-broadcasts error:", err);

    return NextResponse.json(
      { error: "Failed to load scheduled broadcasts." },
      { status: 500 },
    );
  }
}
