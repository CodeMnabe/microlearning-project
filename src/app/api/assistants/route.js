import { NextResponse } from "next/server";
import {
  createAssistant,
  getAssistantsInOrg,
} from "@/lib/repos/assistants.repo";
import { createOAiAssistant } from "@/lib/services/oAi.services";
import { handleApiError, requireOwnedOrg } from "@/lib/auth/guards";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = Number(searchParams.get("orgId"));

    const orgAuth = await requireOwnedOrg(orgId);
    if (orgAuth.error) return orgAuth.error;

    const assistants = await getAssistantsInOrg(orgAuth.orgId);
    return NextResponse.json(assistants, { status: 200 });
  } catch (err) {
    return handleApiError(err, "Failed to load assistants");
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const orgAuth = await requireOwnedOrg(body.organizationId);
    if (orgAuth.error) return orgAuth.error;

    if (!body.name || !body.model) {
      return NextResponse.json(
        { error: "Missing required fields: name, model" },
        { status: 400 },
      );
    }

    const ai = await createOAiAssistant({
      name: body.name,
      description: body.description,
      instructions: body.instructions,
      model: body.model,
      top_p: body.top_p,
      temperature: body.temperature,
      organizationId: orgAuth.orgId,
    });

    const row = await createAssistant({
      organizationId: orgAuth.orgId,
      openAiId: ai.id,
      name: body.name,
      description: body.description,
      instructions: body.instructions,
      model: body.model,
      top_p: body.top_p,
      temperature: body.temperature,
    });

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return handleApiError(err, "Failed to create assistant");
  }
}
