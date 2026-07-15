import { NextResponse } from "next/server";
import { sendMessageToAi } from "@/lib/services/oAi.services";
import { handleApiError, requireOrgForAssistant,requireOrgForThread, } from "@/lib/auth/guards";

export async function POST(req, { params }) {
  try {
    const { assistantId } = await params;
    const { message, threadId } = await req.json();

    if (!message?.trim() || !threadId) {
      return NextResponse.json(
        { error: "Missing message or threadId" },
        { status: 400 },
      );
    }

    const orgAuth = await requireOrgForAssistant(assistantId);
    if (orgAuth.error) return orgAuth.error;

    const threadAuth = await requireOrgForThread(threadId);
    if (threadAuth.error) return threadAuth.error;

    if (threadAuth.orgId !== orgAuth.orgId) {
      return NextResponse.json(
        { error: "Thread does not belong to this assistant organization" },
        { status: 403 },
      );
    }

    if (!threadAuth.thread?.ai_thread_id) {
      return NextResponse.json(
        { error: "Thread is missing OpenAI thread id" },
        { status: 400 },
      );
    }

    const aiMessage = await sendMessageToAi(
      orgAuth.assistant.open_ai_id,
      message,
      threadAuth.thread.ai_thread_id,
    );

    return NextResponse.json(
      {
        reply: aiMessage.handleApiError,
        threadId: threadAuth.thread.id,
        openAiThreadId: threadAuth.thread.open_ai_id,
      },
      { status: 200 },
    );
  } catch (err) {
    return handleApiError(err, "Failed to send assistant message");
  }
}