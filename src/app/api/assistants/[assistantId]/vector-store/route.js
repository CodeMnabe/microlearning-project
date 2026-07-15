// src/app/api/assistants/[assistantId]/vector-store/route.js
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
} from "@/lib/repos/assistants.repo";
import { createDBStore } from "@/lib/repos/store.repo";
import {
  handleApiError,
  requireOrgForAssistant,
} from "@/lib/auth/guards";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export async function POST(req, ctx) {
  try {
    const { assistantId } = await ctx.params;

    const orgAuth = await requireOrgForAssistant(assistantId);
    if (orgAuth.error) return orgAuth.error;

    const { storeName, files } = await req.json();

    if (!storeName || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "Missing storeName/files" },
        { status: 400 },
      );
    }

    const uploadedOpenAiIds = [];
    const fileRowsForDb = [];

    for (const f of files) {
      const { bucket, path, name, type, size } = f || {};

      if (!bucket || !path) {
        return NextResponse.json(
          { error: "Each file needs bucket and path" },
          { status: 400 },
        );
      }

      if (!path.startsWith(`${orgAuth.orgId}/`)) {
        return NextResponse.json(
          { error: "File does not belong to this organization" },
          { status: 403 },
        );
      }

      const { data: signed, error: signErr } = await sb.storage
        .from(bucket)
        .createSignedUrl(path, 60);

      if (signErr) throw signErr;

      const resp = await fetch(signed.signedUrl);

      if (!resp.ok) {
        throw new Error(
          `Failed to fetch ${path} from storage: ${resp.status} ${resp.statusText}`,
        );
      }

      const fileLike = await toFile(
        resp.body ?? (await resp.blob()),
        name || "upload.bin",
        {
          type:
            type ||
            resp.headers.get("content-type") ||
            "application/octet-stream",
        },
      );

      const uploaded = await createOAiFile(fileLike);

      if (!uploaded?.id) {
        return NextResponse.json(
          { error: "Failed to upload a file to OpenAI" },
          { status: 500 },
        );
      }

      uploadedOpenAiIds.push(uploaded.id);

      fileRowsForDb.push({
        open_ai_id: uploaded.id,
        name: name || "file",
        size: Number(size) || null,
      });
    }

    const oaiStore = await createOAiVectorStore(storeName, uploadedOpenAiIds);

    if (!oaiStore?.id) {
      return NextResponse.json(
        { error: "Failed to create OpenAI vector store" },
        { status: 500 },
      );
    }

    const dbStore = await createDBStore(
      { name: oaiStore.name, open_ai_id: oaiStore.id },
      fileRowsForDb,
    );

    await associateStoreToAssistant(orgAuth.assistant.open_ai_id, oaiStore);

    await associateVectorStoreToDbAssistant(orgAuth.assistantId, dbStore.id);

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
      { status: 200 },
    );
  } catch (err) {
    return handleApiError(err, "Failed to create vector store");
  }
}