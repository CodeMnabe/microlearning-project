import { NextResponse } from "next/server";
import { createClient as createSb } from "../../../utils/supabase/server.js";
// import {
//   getTagsInOrg,
//   createTag,
//   updateTag,
//   deleteTag,
// } from "@/lib/repos/tag.repo";
import {
  getTagsInOrg,
  createTag,
  updateTag,
  deleteTag,
} from "@/lib/repos/tag.repo.js";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = Number(searchParams.get("orgId"));
    if (!Number.isFinite(orgId)) {
      return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
    }
    const sb = await createSb();
    const data = await getTagsInOrg(sb, orgId);
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { orgId, name, color } = body;
    if (!orgId || !name) {
      return NextResponse.json(
        { error: "Missing orgId or name" },
        { status: 400 }
      );
    }
    const sb = await createSb();
    const tag = await createTag(sb, { orgId, name, color });
    return NextResponse.json(tag, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const sb = await createSb();
    const updated = await updateTag(sb, id, fields);
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const sb = await createSb();
    await deleteTag(sb, id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
