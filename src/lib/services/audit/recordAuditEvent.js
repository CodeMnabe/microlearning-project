import { buildAuditRow, AUDIT_ACTOR_TYPES } from "@/lib/audit/auditEvents";
import { insertAuditLog } from "@/lib/repos/auditLog.repo";

/**
 * Grava a linha e engole qualquer erro.
 *
 * Uma falha ao gravar o histórico não pode fazer falhar a ação
 * principal, que nesta altura já aconteceu. O erro fica no log
 * do servidor.
 */
async function safelyRecord(organizationId, actor, event) {
  try {
    const row = buildAuditRow({
      organizationId,
      actor,
      ...event,
    });

    await insertAuditLog(row);

    return row;
  } catch (error) {
    console.error("[Audit] failed to record event", {
      action: event?.action,
      organizationId,
      actorType: actor?.type,
      message: error?.message || String(error),
    });

    return null;
  }
}

/**
 * Regista no histórico uma ação feita pelo utilizador autenticado.
 *
 * orgAuth é o resultado de requireOwnedOrg ou de uma das variantes
 * requireOrgFor*, que já traz a organização e o utilizador.
 */
export async function recordAuditEvent(orgAuth, event = {}) {
  return safelyRecord(
    orgAuth?.orgId ?? orgAuth?.org?.id,
    {
      type: AUDIT_ACTOR_TYPES.USER,
      userId: orgAuth?.user?.id,
      email: orgAuth?.user?.email,
    },
    event,
  );
}

/**
 * Regista no histórico algo que a plataforma fez sozinha: crons,
 * webhooks de mensagens recebidas, automações disparadas.
 *
 * Fica marcado como "Sistema", sem utilizador associado.
 */
export async function recordSystemAuditEvent(organizationId, event = {}) {
  return safelyRecord(
    organizationId,
    { type: AUDIT_ACTOR_TYPES.SYSTEM },
    event,
  );
}
