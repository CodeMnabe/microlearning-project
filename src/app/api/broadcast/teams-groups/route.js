export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  assertTeamsGroupsBelongToOrg,
  handleApiError,
  requireOwnedOrg,
} from "@/lib/auth/guards";
import { sendTeamsGroupBroadcast } from "@/lib/services/broadcast/sendTeamsGroupBroadcast";
import {
  assertGroupBroadcastContent,
  parseGroupIds,
} from "@/lib/services/broadcast/groupBroadcastOptions";
import { recordAuditEvent } from "@/lib/services/audit/recordAuditEvent";
import { AUDIT_ACTIONS } from "@/lib/audit/auditEvents";

/* Envio imediato para grupos do Teams (#166). */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const orgAuth = await requireOwnedOrg(body?.orgId);
    if (orgAuth.error) return orgAuth.error;

    assertGroupBroadcastContent(body);

    const groups = await assertTeamsGroupsBelongToOrg(
      orgAuth.admin,
      orgAuth.orgId,
      parseGroupIds(body?.groupIds),
    );

    const result = await sendTeamsGroupBroadcast({
      orgId: orgAuth.orgId,
      groupIds: groups.map((group) => group.id),
      message: typeof body?.message === "string" ? body.message : "",
      files: Array.isArray(body?.files) ? body.files : [],
      imageUrls: Array.isArray(body?.imageUrls) ? body.imageUrls : [],
    });

    await recordAuditEvent(orgAuth, {
      action: AUDIT_ACTIONS.BROADCAST_SENT,
      entityId: result?.sendGroupId,
      details: {
        channel: "teams",
        groupCount: groups.length,
        ok: result?.ok ?? 0,
        failed: result?.failed ?? 0,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Failed to send Teams group broadcast");
  }
}
