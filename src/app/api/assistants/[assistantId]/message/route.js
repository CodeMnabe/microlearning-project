import { NextResponse } from "next/server";
import { sendMessageToAi } from "@/lib/services/oAi.services";
import { handleApiError, requireOrgForAssistant } from "@/lib/auth/guards";

export async function POST(req, { params }) {
  try {
    const { assistantId } = await params;
    const { message, threadId } = await req.json();

    const orgAuth = await requireOrgForAssistant(assistantId);
    if (orgAuth.error) return orgAuth.error;

    if (!message?.trim() || !threadId) {
      return NextResponse.json(
        { error: "Missing message or threadId" },
        { status: 400 },
      );
    }

    const aiMessage = await sendMessageToAi(
      orgAuth.assistant.open_ai_id,
      message,
      threadId,
    );

    return NextResponse.json(
      {
        reply: aiMessage.handleApiError,
        threadId: aiMessage.threadID,
      },
      { status: 200 },
    );
  } catch (err) {
    return handleApiError(err, "FAiled to send assistant message");
  }
}
