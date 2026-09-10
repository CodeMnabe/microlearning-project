import { buildAuditRow, AUDIT_ACTOR_TYPES } from "@/lib/audit/auditEvents";
import { insertAuditLog } from "@/lib/repos/auditLog.repo";

/**
 * Regista no histórico uma ação feita pelo utilizador autenticado.
 *
 * orgAuth é o resultado de requireOwnedOrg ou de uma das variantes
 * requireOrgFor*, que já traz a organização e o utilizador.
 *
 * Esta função nunca lança: uma falha ao gravar o histórico não pode
 * fazer falhar a ação principal, que nesta altura já aconteceu.
 * O erro fica no log do servidor.
 */
export async function recordAuditEvent(orgAuth, event = {}) {
  try {
    const row = buildAuditRow({
      organizationId: orgAuth?.orgId ?? orgAuth?.org?.id,
      actor: {
        type: AUDIT_ACTOR_TYPES.USER,
        userId: orgAuth?.user?.id,
        email: orgAuth?.user?.email,
      },
      ...event,
    });

    await insertAuditLog(row);

    return row;
  } catch (error) {
    console.error("[Audit] failed to record event", {
      action: event?.action,
      organizationId: orgAuth?.orgId ?? orgAuth?.org?.id,
      message: error?.message || String(error),
    });

    return null;
  }
}
