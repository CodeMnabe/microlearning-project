import { getSupabaseAdminClient } from "@/lib/db/admin";

const TABLE = "audit_log";

/**
 * Insere uma linha no histórico de atividade.
 *
 * Recebe a linha já no formato da tabela (ver buildAuditRow).
 */
export async function insertAuditLog(row) {
  const sb = getSupabaseAdminClient();

  const { data, error } = await sb.from(TABLE).insert(row).select().single();

  if (error) {
    throw new Error(`${TABLE}: ${error.message}`);
  }

  return data;
}
