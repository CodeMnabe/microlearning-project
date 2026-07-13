import { NextResponse } from "next/server";

import {
  getAssistantVectorStoreService,
  deleteAssistantVectorStoreService,
} from "@/lib/services/assistants";

/**
 * API de detalhe e remoção de vector store.
 *
 * Endpoints:
 * - GET /api/assistants/:assistantId/vector-store/:storeId
 * - DELETE /api/assistants/:assistantId/vector-store/:storeId
 *
 * Gere:
 * - carregamento de uma vector store;
 * - remoção de uma vector store associada ao assistente.
 *
 * Esta route delega a lógica para o service de vector stores.
 */

export async function GET(req, { params }) {
  try {
    const { storeId } = await params;

    const vectorStore = await getAssistantVectorStoreService(Number(storeId));

    if (!vectorStore) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(vectorStore, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req, ctx) {
  try {
    const { assistantId, storeId } = await ctx.params;

    const deleted = await deleteAssistantVectorStoreService({
      assistantId: Number(assistantId),
      storeId: Number(storeId),
    });

    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Vector store and files deleted" },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}