import { NextResponse } from "next/server";
import { createAssistant, getAssistantsInOrg } from "@/lib/db";
require("dotenv").config();
const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("orgId");
    console.log(id);

    const assistants = await getAssistantsInOrg(Number(id));
    return NextResponse.json(assistants);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      organizationId,
      _name,
      _description,
      _instructions,
      _model,
      _top_p,
      _temperature,
    } = body;

    console.log("Body is okay");

    const assistant = await client.beta.assistants.create({
      name: _name,
      description: _description,
      instructions: _instructions,
      model: _model,
      top_p: _top_p,
      temperature: _temperature,
    });

    console.log("Passed through the openai creation");

    if (!assistant) {
      return NextResponse.json(
        { error: "Error creating assistant" },
        { status: 500 }
      );
    }

    console.log("Assistant exists");

    //* TODO: finish adding it to the db
    const assistantDb = await createAssistant({
      organizationId,
      openAiId: assistant.id,
      name: _name,
      description: _description,
      instructions: _instructions,
      model: _model,
      top_p: _top_p,
      temperature: _temperature,
    });

    console.log("Added to the db");

    if (!assistantDb) {
      return NextResponse.json(
        { error: "Error creating assistant on db" },
        { status: 500 }
      );
    }

    console.log("Created new Assistant with ID: " + assistant.id);
    console.log(
      "Created new Assistant on DB with OpenAI ID: " + assistantDb.openAiId
    );
    return NextResponse.json({ message: assistant }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
