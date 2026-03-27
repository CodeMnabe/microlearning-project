import { NextResponse } from "next/server";
import createSupabaseServerClient from "@/utils/supabase/server";
import { deleteUser } from "@/lib/repos/user.repo";

export async function PATCH(req) {
  try {
    const supabase = await createSupabaseServerClient();
    const { ids, assistantId, orgId } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user")
      .update({ assistant_id: assistantId })
      .in("id", ids)
      .eq("organization_id", orgId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { ids } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }

    const results = await Promise.allSettled(
      ids.map((id) => deleteUser(Number(id))),
    );

    const failed = results
      .map((result, index) => ({ result, id: ids[index] }))
      .filter(({ result }) => result.status === "rejected")
      .map(({ result, id }) => ({
        id,
        error: result.reason?.message || "Failed to delete user",
      }));

    return NextResponse.json({
      ok: failed.length === 0,
      deleted: ids.length - failed.length,
      failedCount: failed.length,
      failed,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
