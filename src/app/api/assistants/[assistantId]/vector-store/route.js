import { NextResponse } from "next/server";

import { createAssistantVectorStoreService } from "@/lib/services/assistants";

/**
 * API de criação de vector store para um assistente.
 *
 * Endpoint:
 * - POST /api/assistants/:assistantId/vector-store
 *
 * Gere:
 * - receção dos metadados dos ficheiros enviados;
 * - envio dos dados para o service de vector stores;
 * - devolução da vector store criada.
 *
 * Esta route não deve conter a lógica pesada de criação da store.
 * Essa responsabilidade pertence ao assistantVectorStores.service.js.
 *
 */

export async function POST(req, ctx) {
  try {
    const { assistantId } = await ctx.params;
    const body = await req.json();

    const vectorStore = await createAssistantVectorStoreService(
      Number(assistantId),
      body,
    );

    return NextResponse.json(vectorStore, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 500 },
    );
  }
}