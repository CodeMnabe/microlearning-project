import { NextResponse } from "next/server";
import { sendWhatsappBroadcast } from "@/lib/services/broadcast/sendWhatsappBroadcast";
import {
  assertUsersBelongToOrg,
  assertWhatsappProviderTemplateBelongsToOrg,
  assertWhatsappTemplateBelongsToOrg,
  handleApiError,
  requireAllRecipientsToBeKnownUsers,
  requireOwnedOrg,
} from "@/lib/auth/guards";

export async function POST(req) {
  try {
    const body = await req.json();

    const orgAuth = await requireOwnedOrg(body?.orgId);
    if (orgAuth.error) return orgAuth.error;

    const recipientUserIds = requireAllRecipientsToBeKnownUsers(
      body?.recipients,
    );
    await assertUsersBelongToOrg(
      orgAuth.admin,
      orgAuth.orgId,
      recipientUserIds,
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

    const result = await sendWhatsappBroadcast({
      orgId: orgAuth.orgId,
      message: body?.message || "",
      files: Array.isArray(body?.files) ? body.files : [],
      imageUrls: Array.isArray(body?.imageUrls) ? body.imageUrls : [],
      trackedLinks: Array.isArray(body?.trackedLinks) ? body.trackedLinks : [],
      recipients: recipientUserIds.map((userId) => ({ userId })),
      template: safeTemplate,
      whatsappTemplateId: safeWhatsappTemplateId,
      scheduledBroadcastId: null,
      createdByUserId: null,
      chainMetadata: null,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "WhatsApp broadcast failed");
  }
}
