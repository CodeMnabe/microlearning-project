import { NextResponse } from "next/server";
import { getTrackedLinkReportDetail } from "@/lib/repos/trackedLinks.repo";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const orgId = Number(searchParams.get("orgId"));
    const sendGroupId = String(searchParams.get("sendGroupId") || "").trim();

    if (!orgId || !sendGroupId) {
      return NextResponse.json(
        { error: "Missing required params" },
        { status: 400 },
      );
    }

    const result = await getTrackedLinkReportDetail({
      orgId,
      sendGroupId,
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
