// src/app/api/assistants/[assistantId]/messages/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAssistantById } from "@/lib/repos/assistants.repo";
import { getStoreById } from "@/lib/repos/store.repo";
import { respondOnce } from "@/lib/services/oAi.services";

export async function POST(req, { params }) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Server missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const { assistantId } = await params;
    const { message, threadId } = await req.json(); // threadId is optional (kept for UI)

    if (!message?.trim()) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const a = await getAssistantById(Number(assistantId));
    if (!a) {
      return NextResponse.json(
        { error: "Assistant not found" },
        { status: 404 }
      );
    }

    let vectorStoreOpenAiId = null;
    if (a.vector_store_id) {
      const store = await getStoreById(a.vector_store_id);
      vectorStoreOpenAiId = store?.open_ai_id || null;
    }

    const reply = await respondOnce({
      model: a.model,
      instructions: a.instructions,
      input: message,
      vectorStoreOpenAiId,
    });

    return NextResponse.json(
      { reply, threadId: threadId ?? null },
      { status: 200 }
    );
  } catch (err) {
    console.error("messages (responses) error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to send message" },
      { status: 500 }
    );
  }
}
