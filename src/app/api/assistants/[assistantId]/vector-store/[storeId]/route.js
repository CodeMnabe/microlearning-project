import { NextResponse } from "next/server";
import { getStoreById, deleteStoreById } from "@/lib/repos/store.repo";
import { deleteFileById, getFileById } from "@/lib/repos/files.repo";
import { deleteOAiVectorStoreAndFiles } from "@/lib/services/oAi.services";
import { nullifyVectorStoreToDbAssistant } from "@/lib/repos/assistants.repo";
export async function GET(req, { params }) {
  try {
    const body = await params;
    const storeId = Number(body.storeId);

    const store = await getStoreById(storeId);

    return NextResponse.json(store, { status: 200 });
  } catch (err) {
    return NextResponse.json({ status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const body = await params;
    const storeId = Number(body.storeId);
    const assistantId = Number(body.assistantId);

    const store = await getStoreById(storeId);

    console.log(store);
    const dbFileIds = store.fileIds;
    const fileIds = [];
    for (const fileId of dbFileIds) {
      const file = await getFileById(fileId);
      fileIds.push(file.openAiId);
    }

    console.log(fileIds);

    const deleted = await deleteOAiVectorStoreAndFiles(store.openAiId, fileIds);
    if (!deleted) {
      return NextResponse.json(
        { message: "Failed to delete vector store from OpenAI" },
        { status: 500 }
      );
    }

    // Clean up DB: store, files, assistant link
    await deleteStoreById(storeId);
    for (const fileId of dbFileIds) {
      await deleteFileById(fileId); // <- this line previously used fileId.id which is wrong
    }

    await nullifyVectorStoreToDbAssistant(assistantId);

    return NextResponse.json(
      { message: "Vector store and files deleted" },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json({ status: 500 });
  }
}
