import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getAssistantById } from "@/lib/repos/assistants.repo";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req, { params }) {
  try {
    const { assistantId } = await params;
    const {
      message,
      threadId: incomingAiThreadId, // OpenAI thread id (string)
      assistantId: bodyOpenAiId, // optional override
    } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const dbAssistant = await getAssistantById(Number(assistantId));
    if (!dbAssistant) {
      return NextResponse.json(
        { error: "Assistant not found" },
        { status: 404 }
      );
    }
    const openAiAssistantId = bodyOpenAiId || dbAssistant.open_ai_id;

    // Ensure an OpenAI thread id
    let aiThreadId = incomingAiThreadId;
    if (!aiThreadId) {
      const thread = await client.beta.threads.create();
      aiThreadId = thread.id; // e.g. "thread_abc..."
    }

    // Send user message
    await client.beta.threads.messages.create(aiThreadId, {
      role: "user",
      content: message,
    });

    // Run assistant
    const run = await client.beta.threads.runs.create(aiThreadId, {
      assistant_id: openAiAssistantId,
    });

    // Poll until done (basic)
    let status = run.status;
    const start = Date.now();
    while (
      ![
        "completed",
        "failed",
        "requires_action",
        "cancelled",
        "expired",
      ].includes(status)
    ) {
      if (Date.now() - start > 30000) {
        return NextResponse.json(
          { error: "Run timed out", threadId: aiThreadId },
          { status: 504 }
        );
      }
      await new Promise((r) => setTimeout(r, 800));
      const fresh = await client.beta.threads.runs.retrieve(aiThreadId, run.id);
      status = fresh.status;
    }
    if (status !== "completed") {
      return NextResponse.json(
        { error: `Run ${status}`, threadId: aiThreadId },
        { status: 500 }
      );
    }

    // Latest assistant message
    const msgs = await client.beta.threads.messages.list(aiThreadId, {
      limit: 10,
    });
    const assistantMsg = msgs.data.find((m) => m.role === "assistant");
    const reply =
      assistantMsg?.content?.[0]?.type === "text"
        ? assistantMsg.content[0].text.value
        : "";

    return NextResponse.json({ reply, threadId: aiThreadId });
  } catch (err) {
    console.error("messages POST error:", err);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
