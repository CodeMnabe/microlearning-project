import { NextResponse } from "next/server";
import { updateAssistant, deleteAssistant } from "@/lib/repos/assistants.repo";
import {
  updateOAiAssistant,
  deleteOAiAssistant,
} from "@/lib/services/oAi.services";
import {
  assertAssistantBelongsToOrg,
  cleanPatch,
  handleApiError,
  requireOrgForAssistant,
} from "@/lib/auth/guards";

const ALLOWED_ASSISTANT_PATCH_FIELDS = [
  "name",
  "description",
  "instructions",
  "model",
  "top_p",
  "temperature",
  "vector_store_id",
];

export async function GET(_req, { params }) {
  try {
    const { assistantId } = await params;

    const orgAuth = await requireOrgForAssistant(assistantId);
    if (orgAuth.error) return orgAuth.error;

    return NextResponse.json(
      {
        ...orgAuth.assistant,
        vectorStoreId: orgAuth.assistant.vector_store_id ?? null,
      },
      { status: 200 },
    );
  } catch (err) {
    return handleApiError(err, "Failed to load assistant");
  }
}

export async function PATCH(req, { params }) {
  try {
    const { assistantId } = await params;
    const updates = await req.json();

    const orgAuth = await requireOrgForAssistant(assistantId);
    if (orgAuth.error) return orgAuth.error;

    const patch = cleanPatch(updates, ALLOWED_ASSISTANT_PATCH_FIELDS);

    if (patch.vector_store_id !== undefined && patch.vector_store_id !== null) {
      await assertAssistantBelongsToOrg(
        orgAuth.admin,
        orgAuth.orgId,
        orgAuth.assistantId,
      );
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json(
        { error: "No valid fields provided to update." },
        { status: 400 },
      );
    }

    try {
      await updateOAiAssistant({
        ...patch,
        open_ai_id: orgAuth.assistant.open_ai_id,
      });
    } catch (error) {
      console.error("[assistant PATCH] OpenAI sync failed", error);
    }

    const updated = await updateAssistant(orgAuth.assistantId, patch);

    return NextResponse.json(
      {
        ...updated,
        vectorStoreId: updated.vector_store_id ?? null,
      },
      { status: 200 },
    );
  } catch (err) {
    return handleApiError(err, "Failed to update assistant");
  }
}

export async function DELETE(_req, { params }) {
  try {
    const { assistantId } = await params;

    const orgAuth = await requireOrgForAssistant(assistantId);
    if (orgAuth.error) return orgAuth.error;

    try {
      await deleteOAiAssistant(orgAuth.assistant.open_ai_id);
    } catch (error) {
      console.error("[assistant DELETE] OpenAI delete failed", error);
    }

    await deleteAssistant(orgAuth.assistantId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err, "Failed to delete assistant");
  }
}
