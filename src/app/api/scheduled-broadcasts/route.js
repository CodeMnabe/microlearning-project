import { NextResponse } from "next/server";
import { getOrgScheduledBroadcasts } from "@/lib/repos/scheduledBroadcasts.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json(
        { error: "organizationId is required." },
        { status: 400 },
      );
    }

    const data = await getOrgScheduledBroadcasts(Number(orgId));

    return NextResponse.json({ items: data });
  } catch (err) {
    console.error("GET error: ", error);

    return NextResponse.json(
      { error: "Failed to load scheduled broadcasts." },
      { status: 500 },
    );
  }
}
