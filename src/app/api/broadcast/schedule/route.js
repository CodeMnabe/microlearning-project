import { NextResponse } from "next/server";
import { createScheduledBroadcast } from "@/lib/repos/scheduledBroadcasts.repo";
import {
  assertUsersBelongToOrg,
  extractRecipientUserIds,
  handleApiError,
  requireAllRecipientsToBeKnownUsers,
  requireOwnedOrg,
} from "@/lib/auth/guards";

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      orgId,
      createdByUserId = null,
      channel,
      scheduledFor,
      timezone,
      payload,
      recipientCount = 0,
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

    const payloadRecipients = Array.isArray(payload?.recipients)
      ? payload.recipients
      : [];

    const recipientUserIds =
      requireAllRecipientsToBeKnownUsers(payloadRecipients);
    await assertUsersBelongToOrg(
      orgAuth.admin,
      orgAuth.orgId,
      recipientUserIds,
    );

    let safeCreatedByUserId = null;
    if (createdByUserId) {
      const [verifiedUserId] = await assertUsersBelongToOrg(
        orgAuth.admin,
        orgAuth.orgId,
        [createdByUserId],
      );
      safeCreatedByUserId = verifiedUserId ?? null;
    }

    const cleanPayload = {
      ...payload,
      recipients: payloadRecipients,
    };

    const row = await createScheduledBroadcast({
      organization_id: orgAuth.orgId,
      created_by_user_id: safeCreatedByUserId,
      channel,
      status: "queued",
      scheduled_for: when.toISOString(),
      timezone: timezone || null,
      payload: cleanPayload,
      recipient_count: Number(
        recipientCount || extractRecipientUserIds(payloadRecipients).length,
      ),
    });

    return NextResponse.json({ ok: true, item: row });
  } catch (err) {
    return handleApiError(err, "Failed to schedule broadcast");
  }
}
