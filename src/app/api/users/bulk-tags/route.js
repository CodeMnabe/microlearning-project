import { NextResponse } from "next/server";
import createSupabaseServerClient from "@/utils/supabase/server";

export async function POST(req) {
  const supabase = await createSupabaseServerClient();
  const { ids = [], tagIds = [], op = "add" } = await req.json();

  const userIds = ids.map(Number).filter(Boolean);
  const tagIdsNum = tagIds.map(Number).filter(Boolean);

  if (!userIds.length)
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  if (!tagIdsNum.length && op !== "set")
    return NextResponse.json({ error: "tagIds required" }, { status: 400 });

  if (op === "add") {
    const rows = [];
    for (const uid of userIds)
      for (const tid of tagIdsNum) rows.push({ user_id: uid, tag_id: tid });
    const { error } = await supabase
      .from("user_tag")
      .upsert(rows, { onConflict: "user_id,tag_id", ignoreDuplicates: true });
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (op === "remove") {
    const { error } = await supabase
      .from("user_tag")
      .delete()
      .in("user_id", userIds)
      .in("tag_id", tagIdsNum);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (op === "set") {
    const { error: delErr } = await supabase
      .from("user_tag")
      .delete()
      .in("user_id", userIds);
    if (delErr)
      return NextResponse.json({ error: delErr.message }, { status: 500 });

    if (!tagIdsNum.length) return NextResponse.json({ ok: true }); // set to none

    const rows = [];
    for (const uid of userIds)
      for (const tid of tagIdsNum) rows.push({ user_id: uid, tag_id: tid });
    const { error: addErr } = await supabase
      .from("user_tag")
      .upsert(rows, { onConflict: "user_id,tag_id", ignoreDuplicates: true });
    if (addErr)
      return NextResponse.json({ error: addErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid op" }, { status: 400 });
}
