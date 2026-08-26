import { NextResponse } from "next/server";

import { createClient as createServiceClient } from "@supabase/supabase-js";

import { toFile } from "openai/uploads";

import {
  createOpenAiVectorStore,
  createOpenAiFile,
} from "@/lib/services/openaiFiles.service";

import { associateVectorStoreToDbAssistant } from "@/lib/repos/assistants.repo";

import { createDBStore } from "@/lib/repos/store.repo";
import {
  handleApiError,
  requireOrgForAssistant,
} from "@/lib/auth/guards";

import { requireOrgForAssistant, handleApiError } from "@/lib/auth/guards";

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
     * Security check:
     *
     * - assistant exists
     * - logged-in user owns its organization
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
     * The browser has already uploaded each file
     * to Supabase Storage.
     *
     * Now the server downloads them from Storage
     * and uploads them to OpenAI.
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
       * Create temporary URL for our Supabase file.
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
       * Convert response into the format expected
       * by the OpenAI SDK.
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
       * Create actual OpenAI File.
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
     * Create the actual OpenAI Vector Store.
     */
    const oaiStore = await createOpenAiVectorStore(
      storeName.trim(),
      uploadedOpenAiIds,
    );

    if (!oaiStore?.id) {
      throw new Error("OpenAI did not return a vector store ID");
    }

    /*
     * Save our representation of the vector store
     * and files into Supabase.
     */
    const dbStore = await createDBStore(
      {
        name: oaiStore.name || storeName.trim(),

        open_ai_id: oaiStore.id,
      },

      fileRowsForDb,
    );

    /*
     * IMPORTANT:
     *
     * Associate the Vector Store with OUR DB Assistant.
     *
     * We DO NOT attach the store to an OpenAI Assistant.
     */
    await associateVectorStoreToDbAssistant(auth.assistantId, dbStore.id);

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