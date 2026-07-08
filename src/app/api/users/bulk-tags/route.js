import { NextResponse } from "next/server";
import {
  assertTagsBelongToOrg,
  assertUsersBelongToOrg,
  handleApiError,
  requireOrgForUser,
} from "@/lib/auth/guards";

export async function POST(req) {
  try {
    const { ids = [], tagIds = [], op = "add" } = await req.json();

    const userIds = ids.map(Number).filter(Boolean);
    const tagIdsNum = tagIds.map(Number).filter(Boolean);

    if (!userIds.length) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }

    if (!tagIdsNum.length && op !== "set") {
      return NextResponse.json({ error: "tagIds required" }, { status: 400 });
    }

    const orgAuth = await requireOrgForUser(userIds[0]);
    if (orgAuth.error) return orgAuth.error;

    await assertUsersBelongToOrg(orgAuth.admin, orgAuth.orgId, userIds);
    await assertTagsBelongToOrg(orgAuth.admin, orgAuth.orgId, tagIdsNum);

    if (op === "add") {
      const rows = [];
      for (const uid of userIds) {
        for (const tid of tagIdsNum) rows.push({ user_id: uid, tag_id: tid });
      }

      const { error } = await orgAuth.admin
        .from("user_tag")
        .upsert(rows, { onConflict: "user_id,tag_id", ignoreDuplicates: true });

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (op === "remove") {
      const { error } = await orgAuth.admin
        .from("user_tag")
        .delete()
        .in("user_id", userIds)
        .in("tag_id", tagIdsNum);

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (op === "set") {
      const { error: delErr } = await orgAuth.admin
        .from("user_tag")
        .delete()
        .in("user_id", userIds);

      if (delErr) throw delErr;

      if (!tagIdsNum.length) return NextResponse.json({ ok: true });

      const rows = [];
      for (const uid of userIds) {
        for (const tid of tagIdsNum) rows.push({ user_id: uid, tag_id: tid });
      }

      const { error: addErr } = await orgAuth.admin
        .from("user_tag")
        .upsert(rows, { onConflict: "user_id,tag_id", ignoreDuplicates: true });

      if (addErr) throw addErr;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "invalid op" }, { status: 400 });
  } catch (error) {
    return handleApiError(error, "Failed to update user tags");
  }
}
