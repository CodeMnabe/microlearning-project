const PAGE_SIZE = 1000;

// Agendamentos e cadeias que ainda vão enviar: os ficheiros que referem não
// podem ser apagados.
const PENDING_BROADCAST_STATUSES = ["queued", "processing"];
const PENDING_CHAIN_STATUSES = ["scheduled", "processing", "active"];

/**
 * Ficheiros de uma pasta do Storage, do mais recente para o mais antigo.
 * As subpastas e o marcador de pasta vazia ficam de fora.
 */
export async function listStorageFolder(admin, bucket, folder) {
  const files = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin.storage.from(bucket).list(folder, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "created_at", order: "desc" },
    });

    if (error) throw error;

    const page = data || [];

    files.push(
      ...page.filter(
        (item) => item.id && item.name !== ".emptyFolderPlaceholder",
      ),
    );

    if (page.length < PAGE_SIZE) break;
  }

  return files;
}

/* Com { download: "<nome>" } o Storage responde como anexo com esse nome. */
export function getStoragePublicUrl(admin, bucket, path, options) {
  return (
    admin.storage.from(bucket).getPublicUrl(path, options)?.data?.publicUrl ||
    null
  );
}

export async function removeStorageObject(admin, bucket, path) {
  const { error } = await admin.storage.from(bucket).remove([path]);

  if (error) throw error;
}

/**
 * Mensagens agendadas por enviar (da mais próxima para a mais distante) e
 * passos das cadeias ainda ativas da organização, com o payload onde ficam
 * os URLs dos ficheiros.
 */
export async function getPendingMessageRefs(admin, orgId) {
  const { data: broadcasts, error: broadcastsError } = await admin
    .from("scheduled_broadcast")
    .select("id, payload")
    .eq("organization_id", orgId)
    .in("status", PENDING_BROADCAST_STATUSES)
    .order("scheduled_for", { ascending: true });

  if (broadcastsError) throw broadcastsError;

  const { data: chains, error: chainsError } = await admin
    .from("message_chain")
    .select("id")
    .eq("organization_id", orgId)
    .in("status", PENDING_CHAIN_STATUSES);

  if (chainsError) throw chainsError;

  let steps = [];
  const chainIds = (chains || []).map((chain) => chain.id);

  if (chainIds.length) {
    const { data, error } = await admin
      .from("message_chain_step")
      .select("chain_id, payload")
      .in("chain_id", chainIds);

    if (error) throw error;

    steps = data || [];
  }

  return [
    ...(broadcasts || []).map((row) => ({
      kind: "scheduled",
      id: row.id,
      payload: row.payload,
    })),
    ...steps.map((row) => ({
      kind: "chain",
      id: row.chain_id,
      payload: row.payload,
    })),
  ];
}
