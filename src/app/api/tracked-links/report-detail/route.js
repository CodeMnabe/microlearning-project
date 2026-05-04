import { NextResponse } from "next/server";
import { getTrackedLinkReportDetail } from "@/lib/repos/trackedLinks.repo";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const orgId = Number(searchParams.get("orgId"));
    const scheduledBroadcastIdRaw = searchParams.get("scheduledBroadcastId");
    const linkKey = String(searchParams.get("linkKey") || "").trim();
    const destinationUrl = String(
      searchParams.get("destinationUrl") || "",
    ).trim();

    if (!orgId || !linkKey || !destinationUrl) {
      return NextResponse.json(
        { error: "Missing required params" },
        { status: 400 },
      );
    }

    const scheduledBroadcastId =
      scheduledBroadcastIdRaw && scheduledBroadcastIdRaw !== "null"
        ? scheduledBroadcastIdRaw
        : null;

    const result = await getTrackedLinkReportDetail({
      orgId,
      scheduledBroadcastId,
      linkKey,
      destinationUrl,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Tracked link report not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("Tracked link report detail error:", err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 },
    );
  }
}
