import { NextResponse } from "next/server";
import { getTrackedLinkReport } from "@/lib/services/broadcast/trackedLinks";
import { normalizeTrackedLinkToken } from "@/lib/services/broadcast/trackedLink.helpers";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = Number(searchParams.get("orgId"));
    const sendGroupId = normalizeTrackedLinkToken(searchParams.get("sendGroupId"));

    if (!orgId || !sendGroupId) {
      return NextResponse.json(
        { error: "Missing required params" },
        { status: 400 }
      );
    }

    const result = await getTrackedLinkReport({ orgId, sendGroupId });

    if (!result) {
      return NextResponse.json(
        { error: "Tracked link report not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Tracked link report detail error:", error);
    return NextResponse.json(
      { error: error?.message || String(error) },
      { status: 500 }
    );
  }
}
