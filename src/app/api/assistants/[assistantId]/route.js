import { NextResponse } from "next/server";
import {
  getAssistantById,
  updateAssistant,
  deleteAssistant,
} from "@/lib/repos/assistants.repo";
import {
  updateOAiAssistant,
  deleteOAiAssistant,
} from "@/lib/services/oAi.services";

export async function GET(req, { params }) {
  try {
    const { assistantId } = await params;
    const row = await getAssistantById(Number(assistantId));
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Map snake_case → UI camelCase where needed
    const payload = {
      ...row,
      vectorStoreId: row.vector_store_id ?? null, // UI reads vectorStoreId
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { assistantId } = await params;
    const updates = await req.json();

    // Keep OpenAI in sync (ignore errors silently or handle as you prefer)
    try {
      await updateOAiAssistant(updates);
    } catch {}

    const updated = await updateAssistant(Number(assistantId), updates);

    const payload = {
      ...updated,
      vectorStoreId: updated.vector_store_id ?? null,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update assistant: " + err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const { assistantId } = await params;
    const row = await getAssistantById(Number(assistantId));
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    try {
      await deleteOAiAssistant(row.open_ai_id);
    } catch {}

    await deleteAssistant(row.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
