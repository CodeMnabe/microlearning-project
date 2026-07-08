import { NextResponse } from "next/server";
import { sendMessageToAi } from "@/lib/services/openai/openai.service";

/**
 * Endpoint legado de envio de mensagem para assistente.
 *
 * Endpoint:
 * - POST /api/assistants/:assistantId/message
 *
 * Nota:
 * Este endpoint parece ter sido substituído por:
 * - /api/assistants/:assistantId/messages
 *
 * Diferença principal:
 * - este endpoint exige threadId;
 * - o endpoint /messages cria uma thread OpenAI quando ainda não existe.
 *
 * Antes de remover este ficheiro, confirmar se ainda existe algum frontend
 * ou integração externa a chamar esta rota.
 */

require("dotenv").config();
const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
