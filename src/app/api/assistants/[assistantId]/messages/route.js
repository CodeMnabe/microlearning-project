import { NextResponse } from "next/server";
import OpenAI from "openai";
import { handleApiError, requireOrgForAssistant } from "@/lib/auth/guards";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req, { params }) {
  try {
    const { assistantId } = await params;
    const { message, threadId: incomingAiThreadId } = await req.json();

    const orgAuth = await requireOrgForAssistant(assistantId);
    if (orgAuth.error) return orgAuth.error;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const openAiAssistantId = orgAuth.assistant.open_ai_id;

    let aiThreadId = incomingAiThreadId;
    if (!aiThreadId) {
      const thread = await client.beta.threads.create();
      aiThreadId = thread.id;
    }

    await client.beta.threads.messages.create(aiThreadId, {
      role: "user",
      content: message,
    });

    const run = await client.beta.threads.runs.create(aiThreadId, {
      assistant_id: openAiAssistantId,
    });

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
          { status: 504 },
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
      const fresh = await client.beta.threads.runs.retrieve(aiThreadId, run.id);
      status = fresh.status;
    }

    if (status !== "completed") {
      return NextResponse.json(
        { error: `Run ${status}`, threadId: aiThreadId },
        { status: 500 },
      );
    }

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
    return handleApiError(err, "Failed to send assistant message");
  }
}
