import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { toFile } from "openai/uploads";

import { requireOrgForAssistant, handleApiError } from "@/lib/auth/guards";
import {
  adjustFileReservedCapacity,
  getFileCapacityReservation,
  getFilesByCapacityReservation,
  markFileCapacityReconciliationRequired,
  markFilePendingDelete,
  transitionFileLifecycle,
} from "@/lib/repos/files.repo";
import {
  getStoreByCapacityReservation,
  materializeVectorStoreCapacity,
} from "@/lib/repos/store.repo";
import {
  createOpenAiFileLifecycle,
  createOpenAiVectorStoreLifecycle,
  deleteOpenAiFileLifecycle,
  deleteOpenAiVectorStoreLifecycle,
} from "@/lib/helpers/openai.lifecycle";
import { associateStoreToAssistant } from "@/lib/services/oAi.services";
import { downloadWithLimit } from "@/lib/security/streamReader";
import { validateMagicBytes } from "@/lib/security/magicBytes";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SIZE = 20 * 1024 * 1024;

function storeResponse(store, files) {
  return NextResponse.json(
    {
      id: store.id,
      storeName: store.store_name,
      files: files.map(({ id, name, size, size_bytes }) => ({
        id,
        name,
        size: size_bytes ?? size,
      })),
    },
    { status: 200 },
  );
}

export async function POST(req, ctx) {
  try {
    const { assistantId } = await ctx.params;
    const orgAuth = await requireOrgForAssistant(assistantId);
    if (orgAuth.error) return orgAuth.error;

    const { storeName, reservationKey, fileIds = [] } = await req.json();
    if (!storeName || typeof reservationKey !== "string" || !UUID_PATTERN.test(reservationKey)) {
      return NextResponse.json({ error: "Missing storeName or valid reservationKey" }, { status: 400 });
    }

    const reservation = await getFileCapacityReservation(orgAuth.orgId, reservationKey);
    if (!reservation || Number(reservation.assistant_id) !== Number(assistantId)) {
      return NextResponse.json({ error: "Reservation does not belong to this organization/assistant" }, { status: 403 });
    }

    const reservedFiles = await getFilesByCapacityReservation(orgAuth.orgId, reservation.id);
    if (reservedFiles.length !== reservation.requested_file_count) {
      return NextResponse.json({ error: "Reservation file set is incomplete" }, { status: 409 });
    }

    if (Array.isArray(fileIds) && fileIds.length > 0) {
      const expected = reservedFiles.map((file) => Number(file.id)).sort((a, b) => a - b);
      const supplied = fileIds.map(Number).sort((a, b) => a - b);
      if (expected.length !== supplied.length || expected.some((id, index) => id !== supplied[index])) {
        return NextResponse.json({ error: "File ids do not match the reservation" }, { status: 403 });
      }
    }

    const existingStore = await getStoreByCapacityReservation(orgAuth.orgId, reservation.id);
    if (existingStore?.status === "active") {
      return storeResponse(existingStore, reservedFiles);
    }
    if (reservation.status === "reconciliation_required") {
      return NextResponse.json({ error: "Reservation requires remote reconciliation" }, { status: 409 });
    }

    const uploadedOpenAiIds = [];
    for (const dbFile of reservedFiles) {
      if (dbFile.status === "validated" && dbFile.open_ai_id) {
        uploadedOpenAiIds.push(dbFile.open_ai_id);
        continue;
      }

      if (!["pending_upload", "uploaded", "retryable_failed"].includes(dbFile.status)) {
        return NextResponse.json({ error: "File is not available for processing" }, { status: 409 });
      }

      try {
        await transitionFileLifecycle({
          fileId: dbFile.id,
          organizationId: orgAuth.orgId,
          from: dbFile.status,
          to: "validating",
        });
      } catch {
        return NextResponse.json({ error: "File already being processed or not found" }, { status: 409 });
      }

      const { data: signed, error: signErr } = await sb.storage
        .from(dbFile.bucket)
        .createSignedUrl(dbFile.object_path, 60);
      if (signErr) {
        await transitionFileLifecycle({
          fileId: dbFile.id,
          organizationId: orgAuth.orgId,
          from: "validating",
          to: "retryable_failed",
          metadata: { last_error_message: "Failed to create signed url" },
        });
        throw signErr;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      let downloaded;
      try {
        const response = await fetch(signed.signedUrl, { signal: controller.signal, redirect: "error" });
        downloaded = await downloadWithLimit(response, MAX_SIZE);
      } finally {
        clearTimeout(timeoutId);
      }

      const validation = validateMagicBytes(downloaded.buffer, dbFile.safe_extension);
      if (!validation.valid) {
        await transitionFileLifecycle({
          fileId: dbFile.id,
          organizationId: orgAuth.orgId,
          from: "validating",
          to: "rejected",
          metadata: { last_error_code: validation.error },
        });
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      await adjustFileReservedCapacity(orgAuth.orgId, dbFile.id, downloaded.size);
      await transitionFileLifecycle({
        fileId: dbFile.id,
        organizationId: orgAuth.orgId,
        from: "validating",
        to: "processing",
      });

      const fileLike = await toFile(
        downloaded.buffer,
        dbFile.original_name || "upload.bin",
        { type: dbFile.mime_type || "application/octet-stream" },
      );
      const openAiResult = await createOpenAiFileLifecycle(fileLike);
      if (!openAiResult.ok || !openAiResult.value?.id) {
        const nextStatus = openAiResult.outcome === "unknown_outcome"
          ? "unknown_outcome"
          : openAiResult.outcome === "permanent_failed" ? "rejected" : "retryable_failed";
        await transitionFileLifecycle({
          fileId: dbFile.id,
          organizationId: orgAuth.orgId,
          from: "processing",
          to: nextStatus,
          metadata: {
            remote_outcome: openAiResult.outcome,
            last_error_code: openAiResult.code,
            last_error_message: openAiResult.message?.slice(0, 1000),
          },
        });
        return NextResponse.json({ error: "Failed to upload a file to OpenAI" }, { status: 502 });
      }

      const uploaded = openAiResult.value;
      uploadedOpenAiIds.push(uploaded.id);
      try {
        await transitionFileLifecycle({
          fileId: dbFile.id,
          organizationId: orgAuth.orgId,
          from: "processing",
          to: "validated",
          metadata: {
            open_ai_id: uploaded.id,
            checksum_sha256: downloaded.sha256,
            validation_completed_at: new Date().toISOString(),
            remote_outcome: "confirmed_success",
          },
        });
      } catch (updateError) {
        const compensation = await deleteOpenAiFileLifecycle(uploaded.id);
        if (!compensation.ok) {
          await transitionFileLifecycle({
            fileId: dbFile.id,
            organizationId: orgAuth.orgId,
            from: "processing",
            to: "reconciliation_required",
            metadata: {
              open_ai_id: uploaded.id,
              remote_outcome: compensation.outcome,
              last_error_message: compensation.message?.slice(0, 1000),
            },
          }).catch(() => {});
        }
        throw updateError;
      }
    }

    const vectorResult = await createOpenAiVectorStoreLifecycle(
      storeName,
      uploadedOpenAiIds,
      `${reservationKey}:vector-store`,
    );
    if (!vectorResult.ok || !vectorResult.value?.id) {
      return NextResponse.json({ error: "Failed to create OpenAI vector store" }, { status: 502 });
    }

    const remoteStore = vectorResult.value;
    let dbStore;
    try {
      dbStore = await materializeVectorStoreCapacity({
        organizationId: orgAuth.orgId,
        assistantId: Number(assistantId),
        reservationKey,
        storeName: remoteStore.name || storeName,
        remoteId: remoteStore.id,
      });
    } catch (materializationError) {
      const compensation = await deleteOpenAiVectorStoreLifecycle(remoteStore.id);
      if (!compensation.ok) {
        await markFileCapacityReconciliationRequired({
          organizationId: orgAuth.orgId,
          reservationKey,
          remoteVectorStoreId: remoteStore.id,
          errorMessage: compensation.message,
        }).catch(() => {});
      } else {
        await Promise.allSettled(reservedFiles.map((file) =>
          markFilePendingDelete(file.id, orgAuth.orgId, "vector_store_materialization_failed")
        ));
      }
      throw materializationError;
    }

    await associateStoreToAssistant(orgAuth.assistant.open_ai_id, remoteStore);
    return storeResponse(dbStore, reservedFiles);
  } catch (err) {
    return handleApiError(err, "Failed to create vector store");
  }
}
