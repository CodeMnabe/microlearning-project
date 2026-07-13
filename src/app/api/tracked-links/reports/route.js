import { NextResponse } from "next/server";
import { listTrackedLinkReports } from "@/lib/services/broadcast/trackedLinks";

export async function GET(req) {
  try {
    const orgId = Number(new URL(req.url).searchParams.get("orgId"));

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      items: await listTrackedLinkReports(orgId),
    });
  } catch (error) {
    console.error("Tracked link reports error:", error);
    return NextResponse.json(
      { error: error?.message || String(error) },
      { status: 500 }
    );
  }
}
