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
import { createDBFile } from "@/lib/repos/files.repo";

export async function POST(req, { params }) {
  try {
    const body = await params;
    const assistantId = body.assistantId;
    const form = await req.formData();
    const storeName = form.get("storeName");
    const files = form.getAll("files");

    const uploadedFilesId = [];
    const fileIds = [];
    for (const file of files) {
      // waits for this upload to finish before continuing
      const uploaded = await createOAiFile(file);
      if (!uploaded) {
        return NextResponse.json({ status: 500 });
      }

      const newFileId = await createDBFile(uploaded.id, file);
      uploadedFilesId.push(uploaded.id);
      fileIds.push(newFileId);
    }
    const store = await createOAiVectorStore(storeName, uploadedFilesId);

    const assistantOAiId = await getAssistantById(Number(assistantId));
    const updatedAssistant = await associateStoreToAssistant(
      assistantOAiId.openAiId,
      store
    );

    if (!updatedAssistant) {
      console.error("Erro ao associar store ao assistente");
    }

    const dbStore = await createDBStore(store, fileIds);

    const dbAssociation = await associateVectorStoreToDbAssistant(
      Number(assistantId),
      dbStore.id
    );

    if (!dbAssociation) {
      return NextResponse.json({ status: 500 });
    }

    return NextResponse.json({ status: 200 });
  } catch (err) {
    return NextResponse.json(
      { message: `Something went wrong ${err.message}` },
      { status: 400 }
    );
  }
}
