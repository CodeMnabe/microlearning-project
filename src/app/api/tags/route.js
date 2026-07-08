export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  getTagsInOrg,
  createTag,
  updateTag,
  deleteTag,
} from "@/lib/repos/tag.repo.js";
import {
  cleanPatch,
  handleApiError,
  requireOrgForTag,
  requireOwnedOrg,
} from "@/lib/auth/guards";

const ALLOWED_TAG_PATCH_FIELDS = ["name", "color", "is_archived"];

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = Number(searchParams.get("orgId"));

    const orgAuth = await requireOwnedOrg(orgId);
    if (orgAuth.error) return orgAuth.error;

    const data = await getTagsInOrg(orgAuth.admin, orgAuth.orgId);
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (e) {
    return handleApiError(e, "Failed to load tags");
  }
}

export async function POST(req) {
  try {
    const { orgId, name, color } = await req.json();
    if (!orgId || !name) {
      return NextResponse.json(
        { error: "Missing orgId or name" },
        { status: 400 },
      );
    }

    const orgAuth = await requireOwnedOrg(orgId);
    if (orgAuth.error) return orgAuth.error;

    const tag = await createTag(orgAuth.admin, {
      orgId: orgAuth.orgId,
      name,
      color,
    });
    return NextResponse.json(tag, { status: 201 });
  } catch (e) {
    console.error(e);
    return handleApiError(e, "Failed to create tag");
  }
}

export async function PATCH(req) {
  try {
    const { id, ...fields } = await req.json();

    const orgAuth = await requireOrgForTag(id);
    if (orgAuth.error) return orgAuth.error;

    const patch = cleanPatch(fields, ALLOWED_TAG_PATCH_FIELDS);
    if (!Object.keys(patch).length) {
      return NextResponse.json(
        { error: "No valid fields provided to update." },
        { status: 400 },
      );
    }

    const updated = await updateTag(orgAuth.admin, orgAuth.tagId, patch);
    return NextResponse.json(updated);
  } catch (e) {
    return handleApiError(e, "Failed to update tag");
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    const orgAuth = await requireOrgForTag(id);
    if (orgAuth.error) return orgAuth.error;

    await deleteTag(orgAuth.admin, orgAuth.tagId);
    return NextResponse.json({ success: true });
  } catch (e) {
    return handleApiError(e, "Failed to delete tag");
  }
}
