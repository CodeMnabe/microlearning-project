import { NextResponse } from "next/server";

import {
  listAssistantsService,
  createAssistantService,
} from "@/lib/services/assistants";


/**
 * API principal da camada Assistants.
 *
 * Endpoints:
 * - GET /api/assistants
 * - POST /api/assistants
 *
 * Gere:
 * - listagem de assistentes por organização;
 * - criação de novos assistentes.
 *
 * Esta route deve ser apenas a entrada HTTP.
 */

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = Number(searchParams.get("orgId"));

    const assistants = await listAssistantsService(orgId);

    return NextResponse.json(assistants, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const assistant = await createAssistantService(body);

    return NextResponse.json(assistant, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


