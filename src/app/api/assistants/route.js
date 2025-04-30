import { NextResponse } from "next/server";
import {
  createAssistant,
  getAssistantsInOrg,
} from "@/lib/repos/assistants.repo";
import { createOAiAssistant } from "@/lib/services/oAi.services";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("orgId");

    const assistants = await getAssistantsInOrg(Number(id));
    return NextResponse.json(assistants);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    console.log("Body is okay");

    const assistant = await createOAiAssistant(body);

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
      organizationId: body.organizationId,
      openAiId: assistant.id,
      name: body.name,
      description: body.description,
      instructions: body.instructions,
      model: body.model,
      top_p: body.top_p,
      temperature: body.temperature,
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
