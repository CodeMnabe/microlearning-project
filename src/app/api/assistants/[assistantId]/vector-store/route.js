import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { toFile } from "openai/uploads";
import { downloadWithLimit } from "@/lib/security/streamReader";
import { validateMagicBytes } from "@/lib/security/magicBytes";

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
import { getFileById } from "@/lib/repos/files.repo";

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

    const { storeName, fileIds } = await req.json();

    if (!storeName || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json(
        { error: "Missing storeName/fileIds" },
        { status: 400 },
      );
    }

    const uploadedOpenAiIds = [];
    const fileRowsForDb = [];

    for (const fileId of fileIds) {
      const dbFile = await getFileById(fileId).catch(() => null);

      if (!dbFile) {
        return NextResponse.json({ error: `File not found: ${fileId}` }, { status: 404 });
      }

      if (dbFile.organization_id !== orgAuth.orgId || dbFile.assistant_id !== Number(assistantId)) {
        return NextResponse.json({ error: "File does not belong to this organization/assistant" }, { status: 403 });
      }

      if (dbFile.status !== "pending_upload" && dbFile.status !== "uploaded") {
        return NextResponse.json({ error: "File is not pending upload" }, { status: 400 });
      }

      const { data: signed, error: signErr } = await sb.storage
        .from(dbFile.bucket)
        .createSignedUrl(dbFile.object_path, 60);

      if (signErr) throw signErr;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      const resp = await fetch(signed.signedUrl, { signal: controller.signal, redirect: "error" });
      clearTimeout(timeoutId);

      const MAX_SIZE = 20 * 1024 * 1024;
      const { buffer, size, sha256 } = await downloadWithLimit(resp, MAX_SIZE);

      const validation = validateMagicBytes(buffer, dbFile.safe_extension);
      if (!validation.valid) {
         // Mark as rejected in DB
         await sb.from("file").update({ status: "rejected", last_error_code: validation.error }).eq("id", dbFile.id);
         return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      const fileLike = await toFile(
        buffer,
        dbFile.original_name || "upload.bin",
        {
          type: dbFile.mime_type || "application/octet-stream",
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

      // Update dbFile locally in memory to pass to createDBStore,
      // and update the actual DB to reflect the new state.
      const { error: updErr } = await sb.from("file").update({
        open_ai_id: uploaded.id,
        status: "validated",
        size_bytes: size,
        checksum_sha256: sha256,
        validation_completed_at: new Date().toISOString()
      }).eq("id", dbFile.id);

      if (updErr) throw updErr;

      fileRowsForDb.push({
        id: dbFile.id,
        open_ai_id: uploaded.id,
        name: dbFile.original_name || "file",
        size: dbFile.size_bytes || null,
      });
    }

    const oaiStore = await createOAiVectorStore(storeName, uploadedOpenAiIds);

    if (!oaiStore?.id) {
      return NextResponse.json(
        { error: "Failed to create OpenAI vector store" },
        { status: 500 },
      );
    }

    // createDBStore expects to create NEW file rows, BUT we already have the rows created by the intent.
    // So we just need to update them with vector_store_id.
    const dbStore = await createDBStore(
      { name: oaiStore.name, open_ai_id: oaiStore.id },
      [] // don't create new files
    );

    // Attach the existing files to the new vector store
    for (const fileRow of fileRowsForDb) {
      await sb.from("file").update({ vector_store_id: dbStore.id }).eq("id", fileRow.id);
    }

    await associateStoreToAssistant(orgAuth.assistant.open_ai_id, oaiStore);
    await associateVectorStoreToDbAssistant(orgAuth.assistantId, dbStore.id);

    return NextResponse.json(
      {
        id: dbStore.id,
        storeName: dbStore.store_name,
        files: fileRowsForDb.map(({ id, name, size }) => ({
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
