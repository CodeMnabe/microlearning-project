// src/app/api/assistants/[assistantId]/vector-store/route.js
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { toFile } from "openai/uploads"; // works with 4.89.1

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

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export async function POST(req, ctx) {
  try {
    const { assistantId } = await ctx.params; // ⬅️ await params
    const { storeName, files } = await req.json(); // ⬅️ JSON, not formData()

    if (!storeName || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "Missing storeName/files" },
        { status: 400 }
      );
    }

    const uploadedOpenAiIds = [];
    const fileRowsForDb = [];

    // Download each file from Supabase and upload to OpenAI
    for (const f of files) {
      const { bucket, path, name, type, size } = f || {};
      if (!bucket || !path) {
        return NextResponse.json(
          { error: "Each file needs bucket and path" },
          { status: 400 }
        );
      }

      // 1) Get a short-lived signed URL
      const { data: signed, error: signErr } = await sb.storage
        .from(bucket)
        .createSignedUrl(path, 60); // seconds
      if (signErr) throw signErr;

      // 2) Fetch the file bytes as a stream
      const resp = await fetch(signed.signedUrl);
      if (!resp.ok) {
        throw new Error(
          `Failed to fetch ${path} from storage: ${resp.status} ${resp.statusText}`
        );
      }

      // 3) Convert to a File-like for the OpenAI SDK
      //    Prefer streaming body; fallback to blob if body isn't present.
      const fileLike = await toFile(
        resp.body ?? (await resp.blob()),
        name || "upload.bin",
        {
          type:
            type ||
            resp.headers.get("content-type") ||
            "application/octet-stream",
        }
      );

      // 4) Upload to OpenAI
      const uploaded = await createOAiFile(fileLike); // your helper
      if (!uploaded?.id) {
        return NextResponse.json(
          { error: "Failed to upload a file to OpenAI" },
          { status: 500 }
        );
      }

      uploadedOpenAiIds.push(uploaded.id);
      fileRowsForDb.push({
        open_ai_id: uploaded.id,
        name: name || "file",
        size: Number(size) || null,
      });
    }

    // 5) Create OpenAI Vector Store from file IDs
    const oaiStore = await createOAiVectorStore(storeName, uploadedOpenAiIds);
    if (!oaiStore?.id) {
      return NextResponse.json(
        { error: "Failed to create OpenAI vector store" },
        { status: 500 }
      );
    }

    // 6) Create DB store + files
    const dbStore = await createDBStore(
      { name: oaiStore.name, open_ai_id: oaiStore.id },
      fileRowsForDb
    );

    // 7) Associate to assistant in OpenAI
    const dbAssistant = await getAssistantById(Number(assistantId));
    await associateStoreToAssistant(dbAssistant.open_ai_id, oaiStore);

    // 8) Link on our assistant row
    await associateVectorStoreToDbAssistant(Number(assistantId), dbStore.id);

    // 9) UI payload
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
