import { NextResponse } from "next/server";
import {
  updateScheduledBroadcast,
  deleteScheduledBroadcast,
} from "@/lib/repos/scheduledBroadcasts.repo";
import {
  cleanPatch,
  handleApiError,
  requireOrgForScheduledBroadcast,
} from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PATCH_FIELDS = [
  "channel",
  "scheduled_for",
  "timezone",
  "status",
  "payload",
  "recipient_count",
];

const ALLOWED_MANUAL_STATUSES = new Set(["queued", "cancelled"]);

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const orgAuth = await requireOrgForScheduledBroadcast(id);
    if (orgAuth.error) return orgAuth.error;

    const patch = cleanPatch(body, ALLOWED_PATCH_FIELDS);

    if (patch.status && !ALLOWED_MANUAL_STATUSES.has(patch.status)) {
      return NextResponse.json(
        { error: "Invalid manual status update." },
        { status: 400 },
      );
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided to update." },
        { status: 400 },
      );
    }

    const data = await updateScheduledBroadcast(orgAuth.broadcastId, patch);
    return NextResponse.json({ item: data });
  } catch (err) {
    return handleApiError(err, "Failed to update scheduled broadcast");
  }
}

export async function DELETE(_req, { params }) {
  try {
    const { id } = await params;

    const orgAuth = await requireOrgForScheduledBroadcast(id);
    if (orgAuth.error) return orgAuth.error;

    await deleteScheduledBroadcast(orgAuth.broadcastId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "Failed to delete scheduled broadcast");
  }
}
