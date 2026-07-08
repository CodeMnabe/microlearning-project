import { NextResponse } from "next/server";
import { getOrgScheduledBroadcasts } from "@/lib/repos/scheduledBroadcasts.repo";
import { handleApiError, requireOwnedOrg } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SOURCES = new Set(["all", "manual", "automation"]);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const orgId = searchParams.get("orgId");
    const sourceRaw = searchParams.get("source") || "all";
    const source = ALLOWED_SOURCES.has(sourceRaw) ? sourceRaw : "all";

    const orgAuth = await requireOwnedOrg(orgId);
    if (orgAuth.error) return orgAuth.error;

    const data = await getOrgScheduledBroadcasts(orgId, { source });

    return NextResponse.json({ items: data });
  } catch (err) {
    return handleApiError(err, "Failed to load scheduled broadcasts");
  }
}
