import { NextResponse } from "next/server";
import { listScheduledBroadcasts } from "@/lib/services/broadcast/scheduledBroadcasts/scheduledBroadcasts.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lists scheduled Broadcasts for an organization. */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgIdRaw = searchParams.get("orgId");
    const orgId = Number(orgIdRaw);

    if (!orgIdRaw || Number.isNaN(orgId)) {
      return NextResponse.json({ error: "orgId is required." }, { status: 400 });
    }

    const items = await listScheduledBroadcasts({
      orgId,
      source: searchParams.get("source") || "all",
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/scheduled-broadcasts error:", error);
    return NextResponse.json(
      { error: "Failed to load scheduled broadcasts." },
      { status: 500 }
    );
  }
}
