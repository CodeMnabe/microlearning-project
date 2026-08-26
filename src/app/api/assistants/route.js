import { NextResponse } from "next/server";

import {
  createAssistant,
  getAssistantsInOrg,
} from "@/lib/repos/assistants.repo";

import {
  handleApiError,
  requireOwnedOrg,
  parsePositiveInt,
} from "@/lib/auth/guards";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const orgId = parsePositiveInt(searchParams.get("orgId"));

    if (!orgId) {
      return NextResponse.json(
        { error: "Invalid organization id" },
        { status: 400 },
      );
    }

    /*
     * Make sure the logged-in user actually owns
     * this organization.
     */
    const orgAuth = await requireOwnedOrg(orgId);

    if (orgAuth.error) {
      return orgAuth.error;
    }

    /*
     * IMPORTANT:
     *
     * Pass orgAuth.orgId, NOT:
     *
     * orgAuth.organizationId
     * orgAuth.id
     * orgAuth.org.id accidentally renamed elsewhere
     *
     * requireOwnedOrg() returns `orgId`.
     */
    const assistants = await getAssistantsInOrg(orgAuth.orgId);

    return NextResponse.json(assistants, { status: 200 });
  } catch (err) {
    return handleApiError(err, "Failed to load assistants");
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const orgId = parsePositiveInt(body?.organizationId);

    if (!orgId) {
      return NextResponse.json(
        { error: "Invalid organization id" },
        { status: 400 },
      );
    }

    const orgAuth = await requireOwnedOrg(orgId);

    if (orgAuth.error) {
      return orgAuth.error;
    }

    const name = typeof body?.name === "string" ? body.name.trim() : "";

    const model = typeof body?.model === "string" ? body.model.trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "Assistant name is required" },
        { status: 400 },
      );
    }

    if (!model) {
      return NextResponse.json(
        { error: "Assistant model is required" },
        { status: 400 },
      );
    }

    /*
     * No OpenAI Assistant is created here anymore.
     *
     * Our Supabase row IS the assistant configuration.
     */
    const assistant = await createAssistant({
      organizationId: orgAuth.orgId,
      name,
      description: body.description ?? null,
      instructions: body.instructions ?? null,
      model,
      top_p: body.top_p ?? null,
      temperature: body.temperature ?? null,
    });

    return NextResponse.json(assistant, { status: 201 });
  } catch (err) {
    return handleApiError(err, "Failed to create assistant");
  }
}
