import { NextResponse } from "next/server";
import {
  getAssistantById,
  updateAssistant,
  deleteAssistant,
} from "@/lib/repos/assistants.repo";
import {
  getOAiAssistantById,
  updateOAiAssistant,
  deleteOAiAssistant,
  sendMessageToAi,
} from "@/lib/services/oAi.services";
require("dotenv").config();
const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET(req, { params }) {
  try {
    const body = await params;
    const assistantId = body.assistantId;
    const assistant = await getAssistantById(Number(assistantId));
    const aiAssistant = await getOAiAssistantById(assistant.openAiId);
    console.log(assistant.instructions);
    console.log();
    console.log(aiAssistant.instructions);

    if (!aiAssistant) {
      return NextResponse.json(
        { error: "Erro com a ligação ao Assistant." },
        { status: 404 }
      );
    }

    if (assistant.instructions != aiAssistant.instructions) {
      return NextResponse.json(
        {
          error: "Incoerência entre DB e ligação com o Assistant",
        },
        { status: 409 }
      );
    }

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
    const body = await params;
    const assistantId = body.assistantId;
    const updates = await req.json();

    if (!assistantId || isNaN(assistantId)) {
      return NextResponse.json(
        { error: "Invalid or missing assistant ID" },
        { status: 400 }
      );
    }

    const myUpdatedAssistant = await updateOAiAssistant(updates);

    if (!myUpdatedAssistant) {
      return NextResponse.json(
        { error: "Error updating assistant on OpenAI" },
        { status: 400 }
      );
    }

    const updated = await updateAssistant(Number(assistantId), updates);

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update assistant: " + err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const body = await params;
    const assistantId = body.assistantId;
    const assistant = await getAssistantById(Number(assistantId));

    await deleteOAiAssistant(assistant.openAiId);
    await deleteAssistant(assistant.id);

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
