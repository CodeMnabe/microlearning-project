import { NextResponse } from "next/server";
import createSupabaseServerClient from "@/utils/supabase/server";

export async function PATCH(req) {
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

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const supabase = await createSupabaseServerClient();
  const { ids, orgId } = await req.json();

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  const { error } = (await supabase)
    .from("user")
    .delete()
    .in("id", ids)
    .eq("organization_id", orgId);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
