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
import { requireOrgForTag, requireOwnedOrg } from "@/lib/auth/guards";

// ✅ admin client (bypasses RLS)
const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const auth = await requireOwnedOrg(searchParams.get("orgId"));
    if (auth.error) return auth.error;

    const data = await getTagsInOrg(admin, auth.orgId);
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { orgId, name, color } = await req.json();
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Missing name" },
        { status: 400 },
      );
    }

    const auth = await requireOwnedOrg(orgId);
    if (auth.error) return auth.error;

    const tag = await createTag(admin, {
      orgId: auth.orgId,
      name: name.trim(),
      color,
    });
    return NextResponse.json(tag, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const { id, name, color } = await req.json();
    const auth = await requireOrgForTag(id);
    if (auth.error) return auth.error;

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const fields = {};
    if (name !== undefined) fields.name = name.trim();
    if (color !== undefined) fields.color = color;

    const updated = await updateTag(admin, auth.tagId, fields);
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const auth = await requireOrgForTag(searchParams.get("id"));
    if (auth.error) return auth.error;

    await deleteTag(admin, auth.tagId);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
