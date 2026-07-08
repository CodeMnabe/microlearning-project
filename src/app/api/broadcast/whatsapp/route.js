import { NextResponse } from "next/server";
import { sendWhatsappBroadcast } from "@/lib/services/broadcast/sendWhatsappBroadcast";
import {
  assertUsersBelongToOrg,
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

    const result = await sendWhatsappBroadcast({
      ...body,
      orgId: orgAuth.orgId,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "WhatsApp broadcast failed");
  }
}
