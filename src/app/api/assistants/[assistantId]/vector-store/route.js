import { NextResponse } from "next/server";

import { createClient as createServiceClient } from "@supabase/supabase-js";

import { toFile } from "openai/uploads";

import {
  createOpenAiVectorStore,
  createOpenAiFile,
} from "@/lib/services/openaiFiles.service";

import { associateVectorStoreToDbAssistant } from "@/lib/repos/assistants.repo";

import { createDBStore } from "@/lib/repos/store.repo";

import { requireOrgForAssistant, handleApiError } from "@/lib/auth/guards";

import { recordAuditEvent } from "@/lib/services/audit/recordAuditEvent";
import { AUDIT_ACTIONS } from "@/lib/audit/auditEvents";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
    },
  },
);

export async function POST(req, ctx) {
  try {
    const { assistantId } = await ctx.params;

    /*
     * =========================================================
     * AUTHORIZE ASSISTANT
     * =========================================================
     *
     * Ensures:
     *
     * - Assistant exists
     * - Logged-in user owns its organization
     */
    const auth = await requireOrgForAssistant(assistantId);

    if (auth.error) {
      return auth.error;
    }

    const { storeName, files } = await req.json();

    if (typeof storeName !== "string" || !storeName.trim()) {
      return NextResponse.json(
        {
          error: "Vector store name is required",
        },
        {
          status: 400,
        },
      );
    }

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        {
          error: "At least one file is required",
        },
        {
          status: 400,
        },
      );
    }

    const uploadedOpenAiIds = [];
    const fileRowsForDb = [];

    /*
     * =========================================================
     * UPLOAD FILES TO OPENAI
     * =========================================================
     *
     * Files have already been uploaded to Supabase Storage.
     *
     * We:
     *
     * 1. Validate their organization path.
     * 2. Download from Supabase.
     * 3. Upload to OpenAI Files.
     */
    for (const f of files) {
      const { bucket, path, name, type, size } = f || {};

      if (!bucket || !path) {
        return NextResponse.json(
          {
            error: "Each file requires bucket and path",
          },
          {
            status: 400,
          },
        );
      }

      /*
       * Security from staging:
       *
       * Don't allow a user to reference a Storage
       * object belonging to another organization.
       */
      if (!path.startsWith(`${auth.orgId}/`)) {
        return NextResponse.json(
          {
            error: "File does not belong to this organization",
          },
          {
            status: 403,
          },
        );
      }

      /*
       * Create a temporary signed URL for the
       * Supabase Storage object.
       */
      const { data: signed, error: signErr } = await sb.storage
        .from(bucket)
        .createSignedUrl(path, 60);

      if (signErr) {
        throw signErr;
      }

      if (!signed?.signedUrl) {
        throw new Error(`Could not create signed URL for ${path}`);
      }

      /*
       * Download file from Supabase.
       */
      const response = await fetch(signed.signedUrl);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${path} from Supabase Storage: ${response.status} ${response.statusText}`,
        );
      }

      /*
       * Convert response into a file-like object
       * accepted by the OpenAI SDK.
       */
      const fileLike = await toFile(
        response.body ?? (await response.blob()),

        name || "upload.bin",

        {
          type:
            type ||
            response.headers.get("content-type") ||
            "application/octet-stream",
        },
      );

      /*
       * =========================================================
       * OPENAI FILE
       * =========================================================
       *
       * This is still a valid OpenAI resource.
       *
       * It has nothing to do with the deprecated
       * Assistants API.
       */
      const uploaded = await createOpenAiFile(fileLike);

      if (!uploaded?.id) {
        throw new Error(`OpenAI did not return a file ID for ${name || path}`);
      }

      uploadedOpenAiIds.push(uploaded.id);

      /*
       * Prepare local DB file row.
       */
      fileRowsForDb.push({
        open_ai_id: uploaded.id,

        name: name || "file",

        size: Number.isFinite(Number(size)) ? Number(size) : null,
      });
    }

    /*
     * =========================================================
     * OPENAI VECTOR STORE
     * =========================================================
     *
     * Vector Stores still exist independently
     * from OpenAI Assistants.
     */
    const oaiStore = await createOpenAiVectorStore(
      storeName.trim(),
      uploadedOpenAiIds,
    );

    if (!oaiStore?.id) {
      throw new Error("OpenAI did not return a vector store ID");
    }

    /*
     * =========================================================
     * LOCAL DB VECTOR STORE
     * =========================================================
     */
    const dbStore = await createDBStore(
      {
        name: oaiStore.name || storeName.trim(),

        open_ai_id: oaiStore.id,
      },

      fileRowsForDb,
    );

    /*
     * =========================================================
     * ASSOCIATE WITH OUR DB ASSISTANT
     * =========================================================
     *
     * IMPORTANT:
     *
     * There is no:
     *
     * associateStoreToAssistant()
     *
     * because there is no OpenAI Assistant object anymore.
     *
     * The Responses API receives this Vector Store through:
     *
     * tools: [
     *   {
     *     type: "file_search",
     *     vector_store_ids: [...]
     *   }
     * ]
     */
    await associateVectorStoreToDbAssistant(auth.assistantId, dbStore.id);

    await recordAuditEvent(auth, {
      action: AUDIT_ACTIONS.ASSISTANT_FILES_ADDED,
      entityId: auth.assistantId,
      entityLabel: auth.assistant?.name,
      details: {
        storeId: dbStore.id,
        storeName: dbStore.store_name,
        fileCount: fileRowsForDb.length,
        fileNames: fileRowsForDb.map((file) => file.name),
      },
    });

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
      {
        status: 201,
      },
    );
  } catch (err) {
    return handleApiError(err, "Failed to create vector store");
  }
}
