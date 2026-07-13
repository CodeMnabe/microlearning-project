// src/app/api/assistants/[assistantId]/vector-store/[storeId]/route.js
import { NextResponse } from "next/server";
import { getStoreById, deleteStoreById } from "@/lib/repos/store.repo";
import { deleteFileById } from "@/lib/repos/files.repo";
import { deleteOAiVectorStoreAndFiles } from "@/lib/services/oAi.services";
import { nullifyVectorStoreToDbAssistant } from "@/lib/repos/assistants.repo";
import {
  handleApiError,
  requireOrgForAssistant,
} from "@/lib/auth/guards";

export async function GET(req, { params }) {
  try {
    const { assistantId, storeId } = await params;

    const orgAuth = await requireOrgForAssistant(assistantId);
    if (orgAuth.error) return orgAuth.error;

    const sId = Number(storeId);

    if (!Number.isInteger(sId) || sId <= 0) {
      return NextResponse.json({ error: "Invalid store id" }, { status: 400 });
    }

    if (Number(orgAuth.assistant.vector_store_id) !== sId) {
      return NextResponse.json(
        { error: "Vector store does not belong to this assistant" },
        { status: 403 },
      );
    }

    const store = await getStoreById(sId);

    if (!store) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        id: store.id,
        storeName: store.store_name,
        files: (store.file || []).map(({ id, name, size }) => ({
          id,
          name,
          size,
        })),
      },
      { status: 200 },
    );
  } catch (err) {
    return handleApiError(err, "Failed to load vector store");
  }
}

export async function DELETE(req, ctx) {
  try {
    const { assistantId, storeId } = await ctx.params;

    const orgAuth = await requireOrgForAssistant(assistantId);
    if (orgAuth.error) return orgAuth.error;

    const sId = Number(storeId);

    if (!Number.isInteger(sId) || sId <= 0) {
      return NextResponse.json({ error: "Invalid store id" }, { status: 400 });
    }

    if (Number(orgAuth.assistant.vector_store_id) !== sId) {
      return NextResponse.json(
        { error: "Vector store does not belong to this assistant" },
        { status: 403 },
      );
    }

    const store = await getStoreById(sId);

    if (!store) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const openAiFileIds = (store.file ?? [])
      .map((f) => f.open_ai_id)
      .filter(Boolean);

    const openAiStoreId = store.open_ai_id;

    await nullifyVectorStoreToDbAssistant(orgAuth.assistantId);

    try {
      await deleteOAiVectorStoreAndFiles(openAiStoreId, openAiFileIds);
    } catch (e) {
      console.error("OpenAI delete failed:", e);
    }

    for (const f of store.file ?? []) {
      await deleteFileById(f.id);
    }

    await deleteStoreById(sId);

    return NextResponse.json(
      { message: "Vector store and files deleted" },
      { status: 200 },
    );
  } catch (err) {
    return handleApiError(err, "Failed to delete vector store");
  }
}