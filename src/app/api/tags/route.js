// src/app/api/tags/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  getTagsInOrg,
  createTag,
  updateTag,
  deleteTag,
} from "@/lib/repos/tag.repo.js";

// ✅ admin client (bypasses RLS)
const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = Number(searchParams.get("orgId"));
    if (!Number.isFinite(orgId)) {
      return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
    }
    const data = await getTagsInOrg(admin, orgId);
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { orgId, name, color } = await req.json();
    if (!orgId || !name) {
      return NextResponse.json(
        { error: "Missing orgId or name" },
        { status: 400 }
      );
    }
    const tag = await createTag(admin, { orgId, name, color });
    return NextResponse.json(tag, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const { id, ...fields } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const updated = await updateTag(admin, id, fields);
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
    await deleteTag(admin, id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
