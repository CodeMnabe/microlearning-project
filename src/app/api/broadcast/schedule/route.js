import { NextResponse } from "next/server";
import { createScheduledBroadcast } from "@/lib/repos/scheduledBroadcasts.repo";
import {
  assertUsersBelongToOrg,
  handleApiError,
  requireAllRecipientsToBeKnownUsers,
  requireOwnedOrg,
} from "@/lib/auth/guards";
import { parseOpeningOptions } from "@/lib/services/broadcast/openingOptions";
import { parseQuestionOptions } from "@/lib/services/broadcast/questionOptions";

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

    let opening = { openingBody: null, openingOnly: false };

    let question = { question: null };

    if (channel === "whatsapp") {
      opening = parseOpeningOptions(payload);

      if (opening.error) {
        return NextResponse.json({ error: opening.error }, { status: 400 });
      }

      question = parseQuestionOptions(payload);

      if (question.error) {
        return NextResponse.json({ error: question.error }, { status: 400 });
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
            openingBody: opening.openingBody,
            openingOnly: opening.openingOnly,
            question: question.question,
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

    return NextResponse.json({ ok: true, item: row });
  } catch (err) {
    return handleApiError(err, "Failed to schedule broadcast");
  }
}
