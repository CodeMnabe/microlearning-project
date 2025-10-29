// src/app/api/assistants/[assistantId]/vector-store/[storeId]/route.js
import { NextResponse } from "next/server";
import { getStoreById, deleteStoreById } from "@/lib/repos/store.repo";
import { deleteFileById } from "@/lib/repos/files.repo";
import { deleteOAiVectorStoreAndFiles } from "@/lib/services/oAi.services";
import { nullifyVectorStoreToDbAssistant } from "@/lib/repos/assistants.repo";

export async function GET(req, { params }) {
  try {
    const { storeId } = await params;
    const store = await getStoreById(Number(storeId));
    if (!store)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

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
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req, ctx) {
  try {
    const { assistantId, storeId } = await ctx.params;
    const sId = Number(storeId);
    const aId = Number(assistantId);

    const store = await getStoreById(sId);
    if (!store) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const openAiStoreId = store.open_ai_id || null;
    const openAiFileIds = (store.file || [])
      .map((f) => f.open_ai_id)
      .filter(Boolean);

    // If we have an OpenAI store id, delete remotely (safe to call with empty array)
    if (openAiStoreId) {
      await deleteOAiVectorStoreAndFiles(openAiStoreId, openAiFileIds);
    }

    // Remove DB files and store
    for (const f of store.file || []) {
      await deleteFileById(f.id);
    }
    await deleteStoreById(sId);

    // Clear assistant link
    await nullifyVectorStoreToDbAssistant(aId);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE vector-store failed:", err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}
