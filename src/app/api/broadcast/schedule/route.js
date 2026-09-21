import { NextResponse } from "next/server";
import { createScheduledBroadcast } from "@/lib/repos/scheduledBroadcasts.repo";
import { recordAuditEvent } from "@/lib/services/audit/recordAuditEvent";
import { AUDIT_ACTIONS } from "@/lib/audit/auditEvents";
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

    const {
      orgId,
      channel,
      scheduledFor,
      timezone,
      payload,
    } = body;

    if (!orgId || !channel || !scheduledFor || !payload) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const orgAuth = await requireOwnedOrg(orgId);
    if (orgAuth.error) return orgAuth.error;

    if (!["teams", "whatsapp"].includes(channel)) {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }

    const when = new Date(scheduledFor);
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduledFor date" },
        { status: 400 },
      );
    }

    if (when.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "Scheduled date must be in the future" },
        { status: 400 },
      );
    }

    const rawRecipients =
      channel === "teams"
        ? (Array.isArray(payload?.userIds) ? payload.userIds : []).map(
            (userId) => ({ userId }),
          )
        : Array.isArray(payload?.recipients)
          ? payload.recipients
          : [];

    const recipientUserIds = requireAllRecipientsToBeKnownUsers(rawRecipients);
    await assertUsersBelongToOrg(
      orgAuth.admin,
      orgAuth.orgId,
      recipientUserIds,
    );

    let safeWhatsappTemplateId = null;
    let safeTemplate = null;

    if (channel === "whatsapp") {
      safeWhatsappTemplateId = await assertWhatsappTemplateBelongsToOrg(
        orgAuth.admin,
        orgAuth.orgId,
        payload?.whatsappTemplateId,
      );

      if (!safeWhatsappTemplateId && payload?.template?.projectId) {
        const templateRow = await assertWhatsappProviderTemplateBelongsToOrg(
          orgAuth.admin,
          orgAuth.orgId,
          payload.template.projectId,
        );

        safeTemplate = {
          projectId: templateRow.provider_template_id,
          languageCode: payload.template.languageCode,
          varKeys: Array.isArray(payload.template.varKeys)
            ? payload.template.varKeys
            : [],
          params: Array.isArray(payload.template.params)
            ? payload.template.params
            : [],
          manualParams: payload.template.manualParams || "",
          trackedUrlKey: payload.template.trackedUrlKey || null,
        };
      }
    }

    const cleanPayload = {
      orgId: orgAuth.orgId,
      message: payload?.message || "",
      files: Array.isArray(payload?.files) ? payload.files : [],
      imageUrls: Array.isArray(payload?.imageUrls) ? payload.imageUrls : [],
      trackedLinks: Array.isArray(payload?.trackedLinks)
        ? payload.trackedLinks
        : [],
      ...(channel === "teams"
        ? { userIds: recipientUserIds }
        : {
            recipients: recipientUserIds.map((userId) => ({ userId })),
            template: safeTemplate,
            whatsappTemplateId: safeWhatsappTemplateId,
          }),
    };

    const row = await createScheduledBroadcast({
      organization_id: orgAuth.orgId,
      created_by_user_id: orgAuth.user.id,
      channel,
      status: "queued",
      scheduled_for: when.toISOString(),
      timezone: timezone || null,
      payload: cleanPayload,
      recipient_count: recipientUserIds.length,
    });

    await recordAuditEvent(orgAuth, {
      action: AUDIT_ACTIONS.BROADCAST_SCHEDULED,
      entityType: "scheduled_broadcast",
      entityId: row?.id,
      details: {
        channel,
        recipientCount: recipientUserIds.length,
        scheduledFor: when.toISOString(),
        timezone: timezone || null,
        hasTemplate: Boolean(safeWhatsappTemplateId || safeTemplate),
      },
    });

    return NextResponse.json({ ok: true, item: row });
  } catch (err) {
    return handleApiError(err, "Failed to schedule broadcast");
  }
}
