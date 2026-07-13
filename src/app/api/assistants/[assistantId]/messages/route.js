import { NextResponse } from "next/server";

import { sendAssistantMessageService } from "@/lib/services/assistants";

/**
 * API de mensagens do chat sandbox.
 *
 * Endpoint:
 * - POST /api/assistants/:assistantId/messages
 *
 * Gere:
 * - receção da mensagem enviada pelo utilizador;
 * - envio da mensagem para o service de mensagens;
 * - devolução da resposta do assistente.
 *
 * Esta route deve apenas tratar o pedido HTTP.
 */

export async function POST(req, { params }) {
  try {
    const { assistantId } = await params;

    const {
      message,
      threadId,
      assistantId: openAiAssistantIdOverride,
    } = await req.json();

    const result = await sendAssistantMessageService({
      assistantId: Number(assistantId),
      message,
      threadId,
      openAiAssistantIdOverride,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        error: err.message || "Failed to send message",
        threadId: err.threadId,
      },
      { status: err.status || 500 },
    );
  }
}