import { NextResponse } from "next/server";
import { getAssistantById, updateAssistant } from "@/lib/db";
require("dotenv").config();
const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET(req, { params }) {
  try {
    const body = await params;
    const assistantId = body.assistantId;
    const assistant = await getAssistantById(Number(assistantId));
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

    const myUpdatedAssistant = await client.beta.assistants.update(
      `${updates.openAiId}`,
      {
        name: updates.name,
        description: updates.description,
        instructions: updates.instructions,
        model: updates.model,
        top_p: updates.top_p,
        temperature: updates.temperature,
      }
    );

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

    console.log(assistantId);

    return NextResponse({ status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
