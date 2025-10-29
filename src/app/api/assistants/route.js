// src/app/api/assistants/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  createAssistant,
  getAssistantsInOrg,
} from "@/lib/repos/assistants.repo";
import { createOAiAssistant } from "@/lib/services/oAi.services";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = Number(searchParams.get("orgId"));
    if (!orgId) return NextResponse.json([], { status: 200 });

    const assistants = await getAssistantsInOrg(orgId);
    return NextResponse.json(assistants, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const ai = await createOAiAssistant(body); // still fine to keep
    if (!ai) {
      return NextResponse.json(
        { error: "Error creating assistant" },
        { status: 500 }
      );
    }

    const row = await createAssistant({
      organizationId: body.organizationId,
      openAiId: ai.id,
      name: body.name,
      description: body.description,
      instructions: body.instructions,
      model: body.model,
      top_p: body.top_p,
      temperature: body.temperature,
    });

    return NextResponse.json(row, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
