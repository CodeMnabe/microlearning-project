import { NextResponse } from "next/server";
import { getTrackedLinkReportsByOrg } from "@/lib/repos/trackedLinks.repo";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = Number(searchParams.get("orgId"));

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const items = await getTrackedLinkReportsByOrg(orgId);

    return NextResponse.json({
      ok: true,
      items,
    });
  } catch (err) {
    console.error("Tracked link reports error:", err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 },
    );
  }
}
