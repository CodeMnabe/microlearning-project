import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  assertUsersBelongToOrg,
  handleApiError,
  requireOwnedOrg,
} from "@/lib/auth/guards";
import { validateTrackedLinks } from "@/lib/services/broadcast/trackedLinkUrl";
import { sendTeamsBroadcast } from "@/lib/services/broadcast/sendTeamsBroadcast";
import { processImmediateBroadcast } from "@/lib/services/broadcast/processImmediateBroadcast";
import {
  createImmediateBroadcastRequestHash,
  getIdempotencyKey,
  normalizeImmediateRecipientIds,
  publicImmediateBroadcastResult,
} from "@/lib/services/broadcast/immediateBroadcast";
import { TEAMS_BROADCAST_CONCURRENCY } from "@/lib/limits/costControls";
import { reserveImmediateBroadcastRequest } from "@/lib/repos/immediateBroadcasts.repo";

export async function POST(req) {
  try {
    const body = await req.json();
    const idempotencyKey = getIdempotencyKey(req.headers);
    const recipientUserIds = normalizeImmediateRecipientIds(body?.recipients);
    const orgAuth = await requireOwnedOrg(body?.orgId);
    if (orgAuth.error) return orgAuth.error;
    await assertUsersBelongToOrg(
      orgAuth.admin,
      orgAuth.orgId,
      recipientUserIds,
    );
    const senderPayload = {
      message: body?.message || "",
      files: Array.isArray(body?.files) ? body.files : [],
      imageUrls: Array.isArray(body?.imageUrls) ? body.imageUrls : [],
      trackedLinks: validateTrackedLinks(
        Array.isArray(body?.trackedLinks) ? body.trackedLinks : [],
      ),
    };
    const requestHash = createImmediateBroadcastRequestHash({
      organizationId: orgAuth.orgId,
      actorUserId: orgAuth.user.id,
      channel: "teams",
      recipientUserIds,
      payload: senderPayload,
    });
    const workerId = `immediate-teams:${randomUUID()}`;
    const reserved = await reserveImmediateBroadcastRequest({
      organizationId: orgAuth.orgId,
      actorUserId: orgAuth.user.id,
      channel: "teams",
      idempotencyKey,
      requestHash,
      recipientUserIds,
      workerId,
    });
    if (!reserved?.owner) {
      const status = [
        "completed",
        "partial",
        "failed",
        "unknown_outcome",
      ].includes(reserved?.status)
        ? 200
        : 202;
      return NextResponse.json(publicImmediateBroadcastResult(reserved), {
        status,
      });
    }
    const summary = await processImmediateBroadcast({
      requestId: reserved.request_id,
      organizationId: orgAuth.orgId,
      actorUserId: orgAuth.user.id,
      workerId,
      requestClaimToken: reserved.request_claim_token,
      recipientUserIds,
      concurrency: TEAMS_BROADCAST_CONCURRENCY,
      sendRecipient: ({ userId, deliveryId, beforeProviderSend }) =>
        sendTeamsBroadcast({
          orgId: orgAuth.orgId,
          ...senderPayload,
          userIds: [userId],
          sendGroupId: reserved.request_id,
          createdByUserId: orgAuth.user.id,
          immediateBroadcastDeliveryId: deliveryId,
          beforeProviderSend,
        }).then((result) => result.results?.[0] || result),
    });
    return NextResponse.json(publicImmediateBroadcastResult(summary), {
      status: summary.status === "partial" ? 207 : 200,
    });
  } catch (error) {
    return handleApiError(error, "Teams broadcast failed");
  }
}
