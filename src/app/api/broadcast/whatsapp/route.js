import { NextResponse } from "next/server";
import { sendWhatsappBroadcast } from "@/lib/services/broadcast/sendWhatsappBroadcast";
import {
  assertUsersBelongToOrg,
  handleApiError,
  requireAllRecipientsToBeKnownUsers,
  requireOwnedOrg,
} from "@/lib/auth/guards";
import { parseOpeningOptions } from "@/lib/services/broadcast/openingOptions";

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

    const opening = parseOpeningOptions(body);

    if (opening.error) {
      return NextResponse.json({ error: opening.error }, { status: 400 });
    }

    const result = await sendWhatsappBroadcast({
      orgId: orgAuth.orgId,
      message: body?.message || "",
      files: Array.isArray(body?.files) ? body.files : [],
      imageUrls: Array.isArray(body?.imageUrls) ? body.imageUrls : [],
      trackedLinks: Array.isArray(body?.trackedLinks) ? body.trackedLinks : [],
      recipients: recipientUserIds.map((userId) => ({ userId })),
      openingBody: opening.openingBody,
      openingOnly: opening.openingOnly,
      scheduledBroadcastId: null,
      createdByUserId: null,
      chainMetadata: null,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "WhatsApp broadcast failed");
  }
}
