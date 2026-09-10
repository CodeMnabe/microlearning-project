import { NextResponse } from "next/server";
import { deleteUser } from "@/lib/repos/user.repo";
import { recordAuditEvent } from "@/lib/services/audit/recordAuditEvent";
import { AUDIT_ACTIONS } from "@/lib/audit/auditEvents";
import {
  assertAssistantBelongsToOrg,
  assertUsersBelongToOrg,
  handleApiError,
  requireOrgForUser,
  requireOwnedOrg,
} from "@/lib/auth/guards";

export async function PATCH(req) {
  try {
    const { ids, assistantId, orgId } = await req.json();
    const userIds = (ids || []).map(Number).filter(Boolean);

    if (!Array.isArray(ids) || userIds.length === 0) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }

    const orgAuth = await requireOwnedOrg(orgId);
    if (orgAuth.error) return orgAuth.error;

    const safeUserIds = await assertUsersBelongToOrg(
      orgAuth.admin,
      orgAuth.orgId,
      userIds,
    );

    const safeAssistantId = await assertAssistantBelongsToOrg(
      orgAuth.admin,
      orgAuth.orgId,
      assistantId,
    );

    const { error } = await orgAuth.admin
      .from("user")
      .update({ assistant_id: safeAssistantId })
      .in("id", safeUserIds)
      .eq("organization_id", orgAuth.orgId);

    if (error) throw error;

    await recordAuditEvent(orgAuth, {
      action: AUDIT_ACTIONS.USER_BULK_UPDATED,
      details: {
        count: safeUserIds.length,
        userIds: safeUserIds,
        assistantId: safeAssistantId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "Failed to update users");
  }
}

export async function DELETE(req) {
  try {
    const { ids } = await req.json();
    const userIds = (ids || []).map(Number).filter(Boolean);

    if (!Array.isArray(ids) || userIds.length === 0) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }

    const orgAuth = await requireOrgForUser(userIds[0]);
    if (orgAuth.error) return orgAuth.error;

    const safeUserIds = await assertUsersBelongToOrg(
      orgAuth.admin,
      orgAuth.orgId,
      userIds,
    );

    const results = await Promise.allSettled(
      safeUserIds.map((id) => deleteUser(id)),
    );

    const failed = results
      .map((result, index) => ({ result, id: safeUserIds[index] }))
      .filter(({ result }) => result.status === "rejected")
      .map(({ result, id }) => ({
        id,
        error: result.reason?.message || "Failed to delete user",
      }));

    if (failed.length < safeUserIds.length) {
      const failedIds = new Set(failed.map((item) => item.id));

      await recordAuditEvent(orgAuth, {
        action: AUDIT_ACTIONS.USER_BULK_DELETED,
        details: {
          count: safeUserIds.length - failed.length,
          userIds: safeUserIds.filter((id) => !failedIds.has(id)),
          failedCount: failed.length,
        },
      });
    }

    return NextResponse.json({
      ok: failed.length === 0,
      deleted: safeUserIds.length - failed.length,
      failedCount: failed.length,
      failed,
    });
  } catch (error) {
    return handleApiError(error, "Failed to delete users");
  }
}