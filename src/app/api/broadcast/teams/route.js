import { NextResponse } from "next/server";

import {
  requireOwnedOrg,
  assertUsersBelongToOrg,
  jsonError,
} from "@/lib/auth/guards";

import { sendTeamsBroadcast } from "@/lib/services/broadcast/sendTeamsBroadcast";

import { recordAuditEvent } from "@/lib/services/audit/recordAuditEvent";
import { AUDIT_ACTIONS } from "@/lib/audit/auditEvents";

function getRecipientUserIds(recipients = []) {
  return recipients
    .map((recipient) => Number(recipient?.userId ?? recipient?.id))
    .filter((userId) => Number.isInteger(userId) && userId > 0);
}

export async function POST(req) {
  try {
    const body = await req.json();

    /*
     * =========================================================
     * AUTHORIZE ORGANIZATION
     * =========================================================
     */
    const orgAuth = await requireOwnedOrg(body?.orgId);

    if (orgAuth.error) {
      return orgAuth.error;
    }

    /*
     * =========================================================
     * VALIDATE RECIPIENTS
     * =========================================================
     */
    const userIds = getRecipientUserIds(body?.recipients);

    if (!userIds.length) {
      return jsonError("No valid recipients selected", 400);
    }

    /*
     * Make sure every selected recipient actually
     * belongs to the authenticated organization.
     */
    await assertUsersBelongToOrg(orgAuth.admin, orgAuth.orgId, userIds);

    /*
     * =========================================================
     * SEND TEAMS BROADCAST
     * =========================================================
     */
    const result = await sendTeamsBroadcast({
      orgId: orgAuth.orgId,

      userIds,

      message: typeof body?.message === "string" ? body.message : "",

      files: Array.isArray(body?.files) ? body.files : [],

      imageUrls: Array.isArray(body?.imageUrls) ? body.imageUrls : [],

      trackedLinks: Array.isArray(body?.trackedLinks) ? body.trackedLinks : [],

      /*
       * This is an immediate broadcast.
       *
       * Scheduled broadcasts can provide these
       * values from their own execution path.
       */
      scheduledBroadcastId: null,

      createdByUserId: null,
    });

    await recordAuditEvent(orgAuth, {
      action: AUDIT_ACTIONS.BROADCAST_SENT,
      entityId: result?.sendGroupId,
      details: {
        channel: "teams",
        recipientCount: userIds.length,
        ok: result?.ok ?? 0,
        failed: result?.failed ?? 0,
      },
    });

    return NextResponse.json(result, {
      status: 200,
    });
  } catch (error) {
    console.error("[Teams Broadcast] failed", error);

    return jsonError(
      error?.message || "Failed to send Teams broadcast",
      error?.status || 500,
    );
  }
}
