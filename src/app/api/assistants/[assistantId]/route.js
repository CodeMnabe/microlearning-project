import { NextResponse } from "next/server";

import {
  getAssistantDetailsService,
  updateAssistantService,
  deleteAssistantService,
} from "@/lib/services/assistants";

/**
 * API de detalhe da camada Assistants.
 *
 * Endpoints:
 * - GET /api/assistants/:assistantId
 * - PATCH /api/assistants/:assistantId
 * - DELETE /api/assistants/:assistantId
 *
 * Gere:
 * - carregamento de um assistente;
 * - atualização de dados do assistente;
 * - remoção do assistente.
 *
 * Esta route delega a lógica para os services da camada Assistants.
 */

export async function GET(req, { params }) {
  try {
    const { assistantId } = await params;

    const assistant = await getAssistantDetailsService(Number(assistantId));

    if (!assistant) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(assistant, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { assistantId } = await params;
    const updates = await req.json();

    const assistant = await updateAssistantService(
      Number(assistantId),
      updates,
    );

    return NextResponse.json(assistant, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update assistant: " + err.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const { assistantId } = await params;

    const deleted = await deleteAssistantService(Number(assistantId));

    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}