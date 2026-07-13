import { NextResponse } from "next/server";
import { deleteUser } from "@/lib/repos/user.repo";
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