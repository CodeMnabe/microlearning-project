import { NextResponse } from "next/server";

import {
  handleApiError,
  requireOrgForAssistant,
  requireOrgForThread,
} from "@/lib/auth/guards";

import {
  createConversation,
  generateAssistantResponse,
} from "@/lib/services/openaiResponses.service";

export async function POST(req, { params }) {
  try {
    const { assistantId } = await params;

    /*
     * =========================================================
     * AUTHORIZE ASSISTANT
     * =========================================================
     */
    const orgAuth = await requireOrgForAssistant(assistantId);

    if (orgAuth.error) {
      return orgAuth.error;
    }

    const { assistant, orgId, assistantId: authorizedAssistantId } = orgAuth;

    /*
     * =========================================================
     * REQUEST BODY
     * =========================================================
     */
    const body = await req.json();

    const message =
      typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json(
        {
          error: "Missing message",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * During migration the frontend may send:
     *
     * conversationId = "conv_..."
     *
     * or, for backwards compatibility:
     *
     * threadId = "conv_..."
     *
     * Staging may also send an actual numeric DB thread ID.
     */
    const incomingConversationId =
      typeof body?.conversationId === "string"
        ? body.conversationId.trim()
        : null;

    const incomingThreadId = body?.threadId ?? null;

    let conversationId = null;

    /*
     * =========================================================
     * NEW RESPONSES API CONVERSATION ID
     * =========================================================
     */
    if (incomingConversationId?.startsWith("conv_")) {
      conversationId = incomingConversationId;
    }

    /*
     * Legacy frontend compatibility.
     *
     * Historically the frontend called the value "threadId"
     * even though it is now an OpenAI Conversation ID.
     */
    if (
      !conversationId &&
      typeof incomingThreadId === "string" &&
      incomingThreadId.startsWith("conv_")
    ) {
      conversationId = incomingThreadId;
    }

    /*
     * =========================================================
     * REAL DB THREAD ID
     * =========================================================
     *
     * If threadId is a database thread ID instead of conv_...,
     * preserve staging's stronger authorization checks.
     */
    if (
      !conversationId &&
      incomingThreadId !== undefined &&
      incomingThreadId !== null &&
      String(incomingThreadId).trim() !== ""
    ) {
      const possibleDbThreadId = Number(incomingThreadId);

      if (Number.isInteger(possibleDbThreadId) && possibleDbThreadId > 0) {
        const threadAuth = await requireOrgForThread(possibleDbThreadId);

        if (threadAuth.error) {
          return threadAuth.error;
        }

        /*
         * The thread must belong to the same organization
         * as the assistant being used.
         */
        if (Number(threadAuth.orgId) !== Number(orgId)) {
          return NextResponse.json(
            {
              error: "Thread does not belong to this assistant organization",
            },
            {
              status: 403,
            },
          );
        }

        /*
         * The thread must also belong to this exact assistant.
         */
        if (
          Number(threadAuth.thread.assistant_id) !==
          Number(authorizedAssistantId)
        ) {
          return NextResponse.json(
            {
              error: "Thread does not belong to this assistant",
            },
            {
              status: 403,
            },
          );
        }

        /*
         * New architecture:
         *
         * use openai_conversation_id,
         * never ai_thread_id.
         */
        const dbConversationId =
          typeof threadAuth.thread.openai_conversation_id === "string"
            ? threadAuth.thread.openai_conversation_id.trim()
            : "";

        if (dbConversationId.startsWith("conv_")) {
          conversationId = dbConversationId;
        }
      }
    }

    /*
     * =========================================================
     * CREATE CONVERSATION
     * =========================================================
     *
     * No existing Conversation was supplied, so create one.
     *
     * This replaces:
     *
     * client.beta.threads.create()
     */
    if (!conversationId) {
      const conversation = await createConversation({
        assistantId: assistant.id,

        organizationId: orgId,

        channel: "web",

        scope: "sandbox",
      });

      if (!conversation?.id) {
        throw new Error("OpenAI did not return a conversation ID");
      }

      conversationId = conversation.id;
    }

    /*
     * =========================================================
     * RESPONSES API
     * =========================================================
     *
     * This replaces:
     *
     * beta.threads.messages.create()
     * beta.threads.runs.create()
     * beta.threads.runs.retrieve()
     * beta.threads.messages.list()
     */
    const result = await generateAssistantResponse({
      assistant,

      conversationId,

      message,
    });

    /*
     * threadId is temporarily returned as an alias so older
     * frontend code continues to work during the migration.
     *
     * It is NOT an Assistants API thread ID.
     *
     * Both values contain:
     *
     * conv_...
     */
    return NextResponse.json({
      reply: result.aiResponse,

      conversationId: result.conversationId,

      threadId: result.conversationId,

      responseId: result.responseId,
    });
  } catch (err) {
    console.error("[Assistant Messages] POST failed:", err);

    return handleApiError(err, "Failed to send assistant message");
  }
}
