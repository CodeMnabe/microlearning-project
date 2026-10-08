import {
  BROADCAST_MEDIA_BUCKETS,
  broadcastMediaFolder,
} from "@/lib/uploads/broadcastMedia";
import {
  getPendingMessageRefs,
  getStoragePublicUrl,
  listStorageFolder,
  removeStorageObject,
} from "@/lib/repos/broadcastMedia.repo";
import { throwHttpError } from "@/lib/auth/guards";

/* O caminho leva "<data>-<aleatório>-" antes do nome original. */
function displayName(fileName) {
  return String(fileName || "").replace(/^\d+-[a-z0-9]+-/, "") || fileName;
}

/**
 * Primeira mensagem por enviar que usa o ficheiro, ou null. O caminho é único
 * (leva data e um sufixo aleatório), por isso basta procurá-lo no texto do
 * payload, onde aparece dentro do URL. As agendadas vêm antes das cadeias.
 */
export function findMediaUsage(path, refs = []) {
  const ref = refs.find((r) => JSON.stringify(r.payload ?? {}).includes(path));

  return ref ? { kind: ref.kind, id: ref.id } : null;
}

/**
 * Só ficheiros diretamente na pasta da organização, num dos buckets de
 * multimédia. Tudo o resto é recusado antes de tocar no Storage.
 */
export function isOwnMediaPath(orgId, bucket, path) {
  if (!BROADCAST_MEDIA_BUCKETS.includes(bucket)) return false;
  if (typeof path !== "string" || path.includes("..")) return false;

  const prefix = `${broadcastMediaFolder(orgId)}/`;
  const rest = path.startsWith(prefix) ? path.slice(prefix.length) : "";

  return Boolean(rest) && !rest.includes("/");
}

export async function listBroadcastMedia(admin, orgId) {
  const folder = broadcastMediaFolder(orgId);
  const refs = await getPendingMessageRefs(admin, orgId);
  const items = [];

  for (const bucket of BROADCAST_MEDIA_BUCKETS) {
    const files = await listStorageFolder(admin, bucket, folder);

    for (const file of files) {
      const path = `${folder}/${file.name}`;
      const usedBy = findMediaUsage(path, refs);
      const name = displayName(file.name);

      items.push({
        bucket,
        path,
        name,
        contentType: file.metadata?.mimetype || null,
        size: Number(file.metadata?.size) || 0,
        createdAt: file.created_at || null,
        url: getStoragePublicUrl(admin, bucket, path),
        downloadUrl: getStoragePublicUrl(admin, bucket, path, {
          download: name,
        }),
        inUse: Boolean(usedBy),
        usedBy,
      });
    }
  }

  items.sort((a, b) =>
    String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
  );

  return {
    items,
    totalBytes: items.reduce((sum, item) => sum + item.size, 0),
  };
}

export async function deleteBroadcastMedia(admin, orgId, { bucket, path }) {
  if (!isOwnMediaPath(orgId, bucket, path)) {
    throwHttpError("Invalid file", 400);
  }

  const refs = await getPendingMessageRefs(admin, orgId);

  if (findMediaUsage(path, refs)) {
    throwHttpError("File is used by a pending message", 409);
  }

  await removeStorageObject(admin, bucket, path);

  return { name: displayName(path.split("/").pop()) };
}
