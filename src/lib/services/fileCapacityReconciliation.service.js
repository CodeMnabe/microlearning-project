import "server-only";

import {
  completeFileCapacityReconciliation,
  getFilesByCapacityReservation,
  listFileCapacityReconciliations,
} from "@/lib/repos/files.repo";
import {
  deleteOpenAiFileLifecycle,
  deleteOpenAiVectorStoreLifecycle,
} from "@/lib/helpers/openai.lifecycle";
import { deleteStorageObjectLifecycle } from "@/lib/helpers/storage.lifecycle";

async function deleteReservationFileRemotes(file) {
  const storageDeleted = !file.object_path || !file.bucket
    ? { ok: true }
    : await deleteStorageObjectLifecycle(file.bucket, file.object_path);

  const sameStorageObject = file.public_bucket === file.bucket
    && file.public_object_path === file.object_path;
  const publicObjectDeleted = !file.public_object_path || !file.public_bucket || sameStorageObject
    ? storageDeleted
    : await deleteStorageObjectLifecycle(file.public_bucket, file.public_object_path);

  const openAiDeleted = !file.open_ai_id
    ? { ok: true }
    : await deleteOpenAiFileLifecycle(file.open_ai_id);

  return storageDeleted.ok && publicObjectDeleted.ok && openAiDeleted.ok;
}

export async function reconcileFileCapacityReservation(reservation) {
  const remoteVectorStoreId = typeof reservation?.remote_vector_store_id === "string"
    ? reservation.remote_vector_store_id.trim()
    : "";
  if (!remoteVectorStoreId) {
    throw new Error("Reconciliation reservation has no usable remote vector store id");
  }

  const remoteVectorStoreDelete = await deleteOpenAiVectorStoreLifecycle(remoteVectorStoreId);
  if (!remoteVectorStoreDelete.ok) {
    return { ok: false, error: remoteVectorStoreDelete.message };
  }

  const files = await getFilesByCapacityReservation(reservation.organization_id, reservation.id);
  const fileCleanup = await Promise.all(files.map(deleteReservationFileRemotes));
  if (fileCleanup.some((deleted) => !deleted)) {
    return { ok: false, error: "Reservation file remote cleanup is incomplete" };
  }

  const completed = await completeFileCapacityReconciliation({
    organizationId: reservation.organization_id,
    reservationKey: reservation.reservation_key,
    remoteVectorStoreId,
    remoteCleanupConfirmed: true,
  });
  return { ok: true, reservation: completed };
}

export async function reconcilePendingFileCapacityReservations(limit = 20) {
  const reservations = await listFileCapacityReconciliations(limit);
  const results = [];
  for (const reservation of reservations) {
    try {
      results.push({
        id: reservation.id,
        ...(await reconcileFileCapacityReservation(reservation)),
      });
    } catch (error) {
      results.push({ id: reservation.id, ok: false, error: error?.message || "Reconciliation failed" });
    }
  }
  return results;
}
