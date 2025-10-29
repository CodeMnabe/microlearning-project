// src/app/api/assistants/[assistantId]/messages/route.js
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getAssistantById } from "@/lib/repos/assistants.repo";
import { getStoreById } from "@/lib/repos/store.repo";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req, { params }) {
  try {
    const { assistantId } = await params;
    const { message, threadId } = await req.json(); // threadId is optional now

    if (!message?.trim()) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    // Your DB “assistant”: has model/instructions and (optionally) vector_store_id
    const a = await getAssistantById(Number(assistantId));
    if (!a)
      return NextResponse.json(
        { error: "Assistant not found" },
        { status: 404 }
      );

    // Wire in file search only if this assistant has a vector store
    let tools, tool_resources;
    if (a.vector_store_id) {
      const store = await getStoreById(a.vector_store_id);
      if (store?.open_ai_id) {
        tools = [{ type: "file_search" }];
        tool_resources = {
          file_search: { vector_store_ids: [store.open_ai_id] },
        };
      }
    }

    // Responses API call (no threads/runs)
    const resp = await client.responses.create({
      model: a.model || "gpt-4.1-mini",
      instructions: a.instructions || undefined,
      input: message,
      ...(tools && { tools }),
      ...(tool_resources && { tool_resources }),
    });

    // Convenient combined text from the SDK
    const reply = resp.output_text || "";

    // Keep returning threadId so your UI doesn’t change (it just won’t be used server-side)
    return NextResponse.json(
      { reply, threadId: threadId ?? null },
      { status: 200 }
    );
  } catch (err) {
    console.error("messages (responses) error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to send message" },
      { status: 500 }
    );
  }
}
