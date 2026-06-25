import { countRows } from "./analyticsBase.repo";

/**
 * Vai buscar métricas dos templates de WhatsApp.
 *
 * Devolve:
 * - total de templates disponíveis;
 * - templates ativos/aprovados;
 * - templates pendentes;
 * - templates rejeitados/inativos.
 */
export async function getTemplateMetrics(orgId) {
  /**
   * Filtro usado para buscar templates:
   *
   * org_id.eq.${orgId}
   * templates específicos da organização.
   *
   * org_id.is.null
   * templates globais, disponíveis para todas as organizações.
   *
   * Ou seja, a dashboard conta templates da organização
   * e também templates globais.
   */
  const templateFilter = `org_id.eq.${orgId},org_id.is.null`;

  /**
   * Executa todas as contagens em paralelo.
   */
  const [total, active, pending, rejected] = await Promise.all([
    /**
     * Conta todos os templates da organização e os templates globais.
     */
    countRows("whatsapp_templates", (q) => q.or(templateFilter)),

    /**
     * Conta templates ativos/aprovados.
     *
     * Usamos várias versões do status para cobrir diferenças
     * de maiúsculas/minúsculas ou nomes usados pela plataforma.
     */
    countRows("whatsapp_templates", (q) =>
      q
        .or(templateFilter)
        .in("status", ["ACTIVE", "active", "APPROVED", "approved"])
    ),

    /**
     * Conta templates pendentes ou em rascunho.
     */
    countRows("whatsapp_templates", (q) =>
      q
        .or(templateFilter)
        .in("status", [
          "PENDING",
          "pending",
          "NEW",
          "new",
          "DRAFT",
          "draft",
          "PENDINGREVIEW",
          "pendingreview",
        ])
    ),

    /**
     * Conta templates rejeitados ou inativos.
     */
    countRows("whatsapp_templates", (q) =>
      q
        .or(templateFilter)
        .in("status", ["REJECTED", "rejected", "INACTIVE", "inactive"])
    ),
  ]);

  /**
   * Devolve as métricas no formato usado pela dashboard.
   */
  return {
    total,
    active,
    pending,
    rejected,
  };
}