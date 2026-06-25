import { countRows } from "./analyticsBase.repo";

/**
 * Vai buscar métricas dos assistentes da organização.
 *
 * Devolve:
 * - total de assistentes;
 * - assistentes sem OpenAI ID configurado.
 */
export async function getAssistantMetrics(orgId) {
  /**
   * Executa as duas contagens em paralelo:
   * uma para o total de assistentes
   * e outra para assistentes sem open_ai_id.
   */
  const [total, withoutOpenAiId] = await Promise.all([
    /**
     * Conta todos os assistentes da organização.
     */
    countRows("assistant", (q) => q.eq("organization_id", orgId)),

    /**
     * Conta assistentes da organização que ainda não têm OpenAI ID.
     *
     * A condição cobre dois casos:
     * - open_ai_id está null;
     * - open_ai_id está vazio.
     */
    countRows("assistant", (q) =>
      q.eq("organization_id", orgId).or("open_ai_id.is.null,open_ai_id.eq.")
    ),
  ]);

  /**
   * Devolve os dados já no formato esperado pela dashboard.
   */
  return {
    total,
    withoutOpenAiId,
  };
}