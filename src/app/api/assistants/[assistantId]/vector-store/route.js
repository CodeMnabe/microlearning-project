import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { toFile } from "openai/uploads";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export async function POST(req, { params }) {
  try {
    const { assistantId } = await params;
    const { storeName, files } = await req.json(); // JSON payload from client

    if (!storeName || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "Missing storeName/files" },
        { status: 400 }
      );
    }

    const uploadedOpenAiIds = [];
    const fileRowsForDb = [];

    // 1) download each object from Supabase Storage, then upload to OpenAI
    for (const f of files) {
      const { data: signed, error: sigErr } = await sb.storage
        .from(f.bucket)
        .createSignedUrl(f.path, 180);
      if (sigErr) throw sigErr;

      const dl = await fetch(signed.signedUrl);
      if (!dl.ok) throw new Error(`Failed to download ${f.name} from Storage`);
      const blob = await dl.blob();

      const fileForOai = await toFile(blob, f.name); // make a real File
      const uploaded = await createOAiFile(fileForOai); // uses openai.files.create
      if (!uploaded?.id)
        throw new Error(`Failed to upload ${f.name} to OpenAI`);

      uploadedOpenAiIds.push(uploaded.id);
      fileRowsForDb.push({
        open_ai_id: uploaded.id,
        name: f.name,
        size: f.size,
      });

      // optional cleanup of the temp object
      try {
        await sb.storage.from(f.bucket).remove([f.path]);
      } catch {}
    }

    // 2) create vector store in OpenAI and attach files
    const oaiStore = await createOAiVectorStore(storeName, uploadedOpenAiIds);
    if (!oaiStore?.id) {
      return NextResponse.json(
        { error: "Failed to create OpenAI vector store" },
        { status: 500 }
      );
    }

    // 3) persist store + files in DB and associate to assistant
    const dbStore = await createDBStore(
      { name: oaiStore.name, open_ai_id: oaiStore.id },
      fileRowsForDb
    );

    const dbAssistant = await getAssistantById(Number(assistantId));
    await associateStoreToAssistant(dbAssistant.open_ai_id, oaiStore);
    await associateVectorStoreToDbAssistant(Number(assistantId), dbStore.id);

    return NextResponse.json({
      id: dbStore.id,
      storeName: dbStore.store_name,
      files: (dbStore.file || []).map(({ id, name, size }) => ({
        id,
        name,
        size,
      })),
    });
  } catch (err) {
    console.error("Vector store create failed:", err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}
