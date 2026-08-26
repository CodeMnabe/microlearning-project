import { NextResponse } from "next/server";

import { getStoreById, deleteStoreById } from "@/lib/repos/store.repo";

import { deleteFileById } from "@/lib/repos/files.repo";

import { nullifyVectorStoreToDbAssistant } from "@/lib/repos/assistants.repo";
import {
  handleApiError,
  requireOrgForAssistant,
} from "@/lib/auth/guards";

import { deleteOpenAiVectorStoreAndFiles } from "@/lib/services/openaiFiles.service";

import { requireOrgForAssistant, handleApiError } from "@/lib/auth/guards";

/* =========================================================
   GET VECTOR STORE
   ========================================================= */

export async function GET(_req, { params }) {
  try {
    const { assistantId, storeId } = await params;

    /*
     * Verify Assistant ownership.
     */
    const auth = await requireOrgForAssistant(assistantId);

    if (auth.error) {
      return auth.error;
    }

    const sId = Number(storeId);

    if (!Number.isInteger(sId) || sId <= 0) {
      return NextResponse.json(
        {
          error: "Invalid store id",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Make sure this store really belongs
     * to this Assistant.
     */
    if (Number(auth.assistant.vector_store_id) !== sId) {
      return NextResponse.json(
        {
          error: "Not found",
        },
        {
          status: 404,
        },
      );
    }

    const store = await getStoreById(sId);

    if (!store) {
      return NextResponse.json(
        {
          error: "Not found",
        },
        {
          status: 404,
        },
      );
    }

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
      {
        status: 200,
      },
    );
  } catch (err) {
    return handleApiError(err, "Failed to load vector store");
  }
}

/* =========================================================
   DELETE VECTOR STORE
   ========================================================= */

export async function DELETE(_req, { params }) {
  try {
    const { assistantId, storeId } = await params;

    /*
     * Verify Assistant ownership.
     */
    const auth = await requireOrgForAssistant(assistantId);

    if (auth.error) {
      return auth.error;
    }

    const sId = Number(storeId);

    if (!Number.isInteger(sId) || sId <= 0) {
      return NextResponse.json(
        {
          error: "Invalid store id",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Don't allow another Assistant's store
     * to be deleted by guessing its ID.
     */
    if (Number(auth.assistant.vector_store_id) !== sId) {
      return NextResponse.json(
        {
          error: "Not found",
        },
        {
          status: 404,
        },
      );
    }

    const store = await getStoreById(sId);

    if (!store) {
      return NextResponse.json(
        {
          error: "Not found",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * OpenAI IDs.
     *
     * THESE IDs ARE STILL VALID/REQUIRED.
     *
     * file.open_ai_id
     * vector_store.open_ai_id
     */
    const openAiFileIds = (store.file ?? [])
      .map((file) => file.open_ai_id)
      .filter(Boolean);

    const openAiStoreId = store.open_ai_id;

    /*
     * Break the local Assistant -> Vector Store
     * relationship first.
     */
    await nullifyVectorStoreToDbAssistant(auth.assistantId);

    /*
     * Delete actual OpenAI resources.
     *
     * This is unrelated to the old Assistants API.
     */
    try {
      await deleteOpenAiVectorStoreAndFiles(openAiStoreId, openAiFileIds);
    } catch (err) {
      console.error("[Vector Store DELETE] OpenAI cleanup failed:", err);

      /*
       * Continue cleaning our DB.
       *
       * Otherwise a failed OpenAI delete could leave
       * our Assistant permanently pointing to a broken
       * local store.
       */
    }

    /*
     * Delete local file rows.
     */
    for (const file of store.file ?? []) {
      await deleteFileById(file.id);
    }

    /*
     * Delete local vector_store row.
     */
    await deleteStoreById(sId);

    return NextResponse.json(
      {
        message: "Vector store and files deleted",
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    return handleApiError(err, "Failed to delete vector store");
  }
}