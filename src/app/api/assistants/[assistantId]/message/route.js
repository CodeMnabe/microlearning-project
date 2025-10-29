import { NextResponse } from "next/server";
import { sendMessageToAi } from "@/lib/services/oAi.services";

import { oai as client } from "@/utils/oAi/oAi.client";

require("dotenv").config();
const OpenAI = require("openai");

export async function POST(req, { params }) {
  try {
    const body = await params;
    const { assistantId, message, threadId } = await req.json();
    if (!assistantId || !message) {
      return NextResponse.json(
        { error: "Invalid or missing components" },
        { status: 400 }
      );
    }

    const aiMessage = await sendMessageToAi(assistantId, message, threadId);

    return NextResponse.json(
      {
        reply: aiMessage.aiResponse,
        threadId: aiMessage.threadId,
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to POST to the assistant: " + err.message },
      { status: 500 }
    );
  }
}
