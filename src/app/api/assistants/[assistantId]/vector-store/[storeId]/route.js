// src/app/api/assistants/[assistantId]/vector-store/[storeId]/route.js
import { NextResponse } from "next/server";
import {
  getStoreById,
  transitionVectorStoreLifecycle,
} from "@/lib/repos/store.repo";
import { deleteOpenAiVectorStoreLifecycle } from "@/lib/helpers/openai.lifecycle";
import { nullifyVectorStoreToDbAssistant } from "@/lib/repos/assistants.repo";
import {
  handleApiError,
  requireOrgForAssistant,
} from "@/lib/auth/guards";

export async function GET(req, { params }) {
  try {
    const { assistantId, storeId } = await params;

    const orgAuth = await requireOrgForAssistant(assistantId);
    if (orgAuth.error) return orgAuth.error;

    const sId = Number(storeId);

    if (!Number.isInteger(sId) || sId <= 0) {
      return NextResponse.json({ error: "Invalid store id" }, { status: 400 });
    }

    if (Number(orgAuth.assistant.vector_store_id) !== sId) {
      return NextResponse.json(
        { error: "Vector store does not belong to this assistant" },
        { status: 403 },
      );
    }

    const store = await getStoreById(sId);

    if (!store) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
      { status: 200 },
    );
  } catch (err) {
    return handleApiError(err, "Failed to load vector store");
  }
}

export async function DELETE(req, ctx) {
  try {
    const { assistantId, storeId } = await ctx.params;

    const orgAuth = await requireOrgForAssistant(assistantId);
    if (orgAuth.error) return orgAuth.error;

    const sId = Number(storeId);

    if (!Number.isInteger(sId) || sId <= 0) {
      return NextResponse.json({ error: "Invalid store id" }, { status: 400 });
    }

    if (Number(orgAuth.assistant.vector_store_id) !== sId) {
      return NextResponse.json(
        { error: "Vector store does not belong to this assistant" },
        { status: 403 },
      );
    }

    const store = await getStoreById(sId);

    if (!store) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const openAiStoreId = store.open_ai_id;

    await nullifyVectorStoreToDbAssistant(orgAuth.assistantId);

    await transitionVectorStoreLifecycle(
      sId,
      orgAuth.orgId,
      ["active", "reconciliation_required"],
      "pending_delete",
    );

    const remoteDelete = await deleteOpenAiVectorStoreLifecycle(openAiStoreId);

    const { markVectorStoreFilesPendingDelete, detachFilesFromVectorStore } = require("@/lib/repos/files.repo");
    await markVectorStoreFilesPendingDelete(sId, orgAuth.orgId, "vector_store_delete");
    await detachFilesFromVectorStore(sId);

    if (remoteDelete.ok) {
      await transitionVectorStoreLifecycle(
        sId,
        orgAuth.orgId,
        "pending_delete",
        "deleted",
        { deleted_at: new Date().toISOString(), last_error_message: null },
      );
    } else {
      await transitionVectorStoreLifecycle(
        sId,
        orgAuth.orgId,
        "pending_delete",
        "reconciliation_required",
        { last_error_message: remoteDelete.message?.slice(0, 1000) },
      );
    }

    return NextResponse.json(
      { message: "Vector store deleted and files marked for cleanup" },
      { status: 202 },
    );
  } catch (err) {
    return handleApiError(err, "Failed to delete vector store");
  }
}
