import { NextResponse } from "next/server";
import {
  requireOwnedOrg,
  assertUsersBelongToOrg,
  jsonError,
} from "@/lib/auth/guards";
import { sendTeamsBroadcast } from "@/lib/services/broadcast/sendTeamsBroadcast";

function getRecipientUserIds(recipients = []) {
  return recipients
    .map((recipient) => Number(recipient?.userId ?? recipient?.id))
    .filter(Boolean);
}

export async function POST(req) {
  try {
    const body = await req.json();

    const orgAuth = await requireOwnedOrg(body?.orgId);
    if (orgAuth) return orgAuth.error;

    const userIds = getRecipientUserIds(body?.recipients);

    if (!userIds.length) {
      return jsonError("No valid recipients selected", 400);
    }

    await assertUsersBelongToOrg(orgAuth.admin, orgAuth.orgId, userIds);

    const result = await sendTeamsBroadcast({
      ...body,
      orgId: orgAuth.orgId,
      organizationId: orgAuth.orgId,
      recipientUserIds: userIds,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[Teams Broadcast] failed", error);
    return jsonError(error.message || "Failed to send Teams broadcast", 500);
  }
}
