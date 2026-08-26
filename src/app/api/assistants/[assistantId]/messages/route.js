import { NextResponse } from "next/server";
import { handleApiError, requireOrgForAssistant } from "@/lib/auth/guards";
import {
  createConversation,
  generateAssistantResponse,
} from "@/lib/services/openaiResponses.service";

export async function POST(req, { params }) {
  try {
    const { assistantId } = await params;

    const auth = await requireOrgForAssistant(assistantId);

    if (auth.error) {
      return auth.error;
    }

    const { assistant, orgId } = auth;

    const body = await req.json();

    const message =
      typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    //During migration we support both names: conversationId, threadId
    const incomingConversationId =
      body?.conversationId ?? body?.threadId ?? null;

    let conversationId =
      typeof incomingConversationId === "string" &&
      incomingConversationId.startsWith("conv_")
        ? incomingConversationId
        : null;

    if (!conversationId) {
      const conversation = await createConversation({
        assistantId: assistant.id,
        organizationId: orgId,
        channel: "web",
        scope: "sandbox",
      });

      conversationId = conversation.id;
    }

    const result = await generateAssistantResponse({
      assistant,
      conversationId,
      message,
    });

    return NextResponse.json({
      reply: result.aiResponse,
      conversationId: result.conversationId,
      threadId: result.conversationId,
      responseId: result.responseId,
    });
  } catch (err) {
    console.error("[Assistant Messages] POST failed:", err);

    return NextResponse.json(
      {
        error: err?.message || "Failed to send the message",
      },
      { status: err?.status || 500 },
    );
  }
}
