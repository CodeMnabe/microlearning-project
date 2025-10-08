// src/app/api/assistants/[assistantId]/vector-store/route.js
import { NextResponse } from "next/server";
import {
  createOAiVectorStore,
  associateStoreToAssistant,
  createOAiFile,
} from "@/lib/services/oAi.services";
import {
  associateVectorStoreToDbAssistant,
  getAssistantById,
} from "@/lib/repos/assistants.repo";
import { createDBStore } from "@/lib/repos/store.repo";

export async function POST(req, { params }) {
  try {
    const { assistantId } = await params;
    const form = await req.formData();
    const storeName = form.get("storeName");
    const files = form.getAll("files") || [];

    if (!storeName || !files.length) {
      return NextResponse.json(
        { error: "Missing storeName/files" },
        { status: 400 }
      );
    }

    // 1) Upload files to OpenAI
    const uploadedOpenAiIds = [];
    const fileRowsForDb = [];
    for (const file of files) {
      const uploaded = await createOAiFile(file);
      if (!uploaded?.id) {
        return NextResponse.json(
          { error: "Failed to upload a file to OpenAI" },
          { status: 500 }
        );
      }
      uploadedOpenAiIds.push(uploaded.id);
      fileRowsForDb.push({
        open_ai_id: uploaded.id,
        name: file.name,
        size: file.size,
      });
    }

    // 2) Create OpenAI Vector Store
    const oaiStore = await createOAiVectorStore(storeName, uploadedOpenAiIds);
    if (!oaiStore?.id) {
      return NextResponse.json(
        { error: "Failed to create OpenAI vector store" },
        { status: 500 }
      );
    }

    // 3) Create DB store + files
    const dbStore = await createDBStore(
      { name: oaiStore.name, open_ai_id: oaiStore.id }, // ← this persists open_ai_id
      fileRowsForDb
    );

    // 4) Associate to assistant in OpenAI
    const dbAssistant = await getAssistantById(Number(assistantId));
    await associateStoreToAssistant(dbAssistant.open_ai_id, oaiStore);

    // 5) Link on our assistant row
    await associateVectorStoreToDbAssistant(Number(assistantId), dbStore.id);

    // 6) Return UI-friendly payload (includes names)
    return NextResponse.json(
      {
        id: dbStore.id,
        storeName: dbStore.store_name,
        files: (dbStore.file || []).map(({ id, name, size }) => ({
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
