import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { sendWhatsappBroadcast } from "@/lib/services/broadcast/sendWhatsappBroadcast";
import { processImmediateBroadcast } from "@/lib/services/broadcast/processImmediateBroadcast";
import {
  assertUsersBelongToOrg,
  assertWhatsappProviderTemplateBelongsToOrg,
  assertWhatsappTemplateBelongsToOrg,
  handleApiError,
  requireOwnedOrg,
} from "@/lib/auth/guards";
import { validateTrackedLinks } from "@/lib/services/broadcast/trackedLinkUrl";
import {
  createImmediateBroadcastRequestHash,
  getIdempotencyKey,
  normalizeImmediateRecipientIds,
  publicImmediateBroadcastResult,
} from "@/lib/services/broadcast/immediateBroadcast";
import { WHATSAPP_BROADCAST_CONCURRENCY } from "@/lib/limits/costControls";
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

    const trackedLinks = validateTrackedLinks(
      Array.isArray(body?.trackedLinks) ? body.trackedLinks : [],
    );
    const safeWhatsappTemplateId = await assertWhatsappTemplateBelongsToOrg(
      orgAuth.admin,
      orgAuth.orgId,
      body?.whatsappTemplateId,
    );
    let safeTemplate = null;
    if (!safeWhatsappTemplateId && body?.template?.projectId) {
      const templateRow = await assertWhatsappProviderTemplateBelongsToOrg(
        orgAuth.admin,
        orgAuth.orgId,
        body.template.projectId,
      );
      safeTemplate = {
        projectId: templateRow.provider_template_id,
        languageCode: body.template.languageCode,
        varKeys: Array.isArray(body.template.varKeys)
          ? body.template.varKeys
          : [],
        params: Array.isArray(body.template.params) ? body.template.params : [],
        manualParams: body.template.manualParams || "",
        trackedUrlKey: body.template.trackedUrlKey || null,
      };
    }
    const senderPayload = {
      message: body?.message || "",
      files: Array.isArray(body?.files) ? body.files : [],
      imageUrls: Array.isArray(body?.imageUrls) ? body.imageUrls : [],
      trackedLinks,
      template: safeTemplate,
      whatsappTemplateId: safeWhatsappTemplateId,
    };
    const requestHash = createImmediateBroadcastRequestHash({
      organizationId: orgAuth.orgId,
      actorUserId: orgAuth.user.id,
      channel: "whatsapp",
      recipientUserIds,
      payload: senderPayload,
    });
    const workerId = `immediate-wa:${randomUUID()}`;
    const reserved = await reserveImmediateBroadcastRequest({
      organizationId: orgAuth.orgId,
      actorUserId: orgAuth.user.id,
      channel: "whatsapp",
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
      concurrency: WHATSAPP_BROADCAST_CONCURRENCY,
      sendRecipient: ({ userId, deliveryId, beforeProviderSend }) =>
        sendWhatsappBroadcast({
          orgId: orgAuth.orgId,
          ...senderPayload,
          recipients: [{ userId }],
          sendGroupId: reserved.request_id,
          createdByUserId: orgAuth.user.id,
          immediateBroadcastDeliveryId: deliveryId,
          beforeProviderSend,
        }).then((result) => result.results?.[0] || result),
    });
    return NextResponse.json(publicImmediateBroadcastResult(summary), {
      status: summary.status === "partial" ? 207 : 200,
    });
  } catch (err) {
    return handleApiError(err, "WhatsApp broadcast failed");
  }
}
