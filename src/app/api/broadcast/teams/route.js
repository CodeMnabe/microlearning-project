import { NextResponse } from "next/server";
import {
  requireOwnedOrg,
  assertUsersBelongToOrg,
  jsonError,
} from "@/lib/auth/guards";
import {sendTeamsBroadcast} from "@/lib/services/broadcast/sendTeamsBroadcast";

function getRecipientUserIds(recipients = []) {
  return recipients
    .map((recipient) => Number(recipient?.userId ?? recipient?.id))
    .filter(Boolean);
}

export async function POST(req) {
  try {
    const body = await req.json();

    const orgAuth = await requireOwnedOrg(body?.orgId);
    if (orgAuth.error) return orgAuth.error;

    const userIds = getRecipientUserIds(body?.recipients);

    if (!userIds.length) {
      return jsonError("No valid recipients selected", 400);
    }

    await assertUsersBelongToOrg(orgAuth.admin, orgAuth.orgId, userIds);

    const result = await sendTeamsBroadcast({
      orgId: orgAuth.orgId,
      userIds,
      message: body?.message || "",
      files: Array.isArray(body?.files) ? body.files : [],
      imageUrls: Array.isArray(body?.imageUrls) ? body.imageUrls : [],
      trackedLinks: Array.isArray(body?.trackedLinks) ? body.trackedLinks : [],
      scheduledBroadcastId: null,
      createdByUserId: null,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Teams Broadcast] failed", error);
    return jsonError(
      error.message || "Failed to send Teams broadcast",
      error.status || 500,
    );
  }
}
