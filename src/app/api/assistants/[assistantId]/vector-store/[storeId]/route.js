import { NextResponse } from "next/server";

import { getStoreById, deleteStoreById } from "@/lib/repos/store.repo";

import { deleteFileById } from "@/lib/repos/files.repo";

import { nullifyVectorStoreToDbAssistant } from "@/lib/repos/assistants.repo";

import { deleteOpenAiVectorStoreAndFiles } from "@/lib/services/openaiFiles.service";

import { requireOrgForAssistant, handleApiError } from "@/lib/auth/guards";

import { recordAuditEvent } from "@/lib/services/audit/recordAuditEvent";
import { AUDIT_ACTIONS } from "@/lib/audit/auditEvents";

/* =========================================================
   GET VECTOR STORE
   ========================================================= */

export async function GET(_req, { params }) {
  try {
    const { assistantId, storeId } = await params;

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
     * Do not reveal whether some other
     * Assistant's Vector Store exists.
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
     * Prevent deleting another Assistant's
     * Vector Store by guessing the ID.
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
     * These OpenAI IDs are still valid.
     *
     * They belong to:
     *
     * OpenAI Files
     * OpenAI Vector Stores
     *
     * NOT OpenAI Assistants.
     */
    const openAiFileIds = (store.file ?? [])
      .map((file) => file.open_ai_id)
      .filter(Boolean);

    const openAiStoreId = store.open_ai_id;

    /*
     * Disconnect the Vector Store from
     * our DB Assistant first.
     */
    await nullifyVectorStoreToDbAssistant(auth.assistantId);

    /*
     * Delete the real OpenAI resources.
     *
     * If OpenAI cleanup fails, we still
     * continue removing our local records
     * so the Assistant is not left linked
     * to a broken store.
     */
    try {
      await deleteOpenAiVectorStoreAndFiles(openAiStoreId, openAiFileIds);
    } catch (err) {
      console.error("[Vector Store DELETE] OpenAI cleanup failed:", err);
    }

    /*
     * Delete local file rows.
     */
    for (const file of store.file ?? []) {
      await deleteFileById(file.id);
    }

    /*
     * Delete local Vector Store row.
     */
    await deleteStoreById(sId);

    await recordAuditEvent(auth, {
      action: AUDIT_ACTIONS.ASSISTANT_FILES_REMOVED,
      entityId: auth.assistantId,
      entityLabel: auth.assistant?.name,
      details: {
        storeId: sId,
        storeName: store.store_name,
        fileCount: (store.file ?? []).length,
        fileNames: (store.file ?? []).map((file) => file.name),
      },
    });

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
