import { applyPeriod } from "./analytics.helpers";
import { fetchRows } from "./analyticsBase.repo";
import { getTrackedLinkClickRows } from "./analyticsTrackedLinks.repo";

/**
 * Vai buscar as linhas usadas para construir os gráficos diários da dashboard.
 *
 * Esta função não devolve ainda os dados prontos para o gráfico.
 * Ela devolve apenas as linhas base da base de dados.
 *
 * Depois, a service usa buildDailySeries para transformar estas linhas
 * numa série diária com valores por data.
 */

export async function getDailyAnalyticsRows(orgId, trendStart) {
  /**
   * Executa todas as queries em paralelo.
   *
   * Isto torna a API mais rápida porque não esperamos por uma query
   * antes de começar a seguinte.
   */
  const [
    messageRows,
    failedMessageRows,
    automationProcessedRows,
    clickRows,
  ] = await Promise.all([
    /**
     * Vai buscar as datas de criação das mensagens.
     *
     * Estas linhas serão usadas para contar mensagens por dia.
     */
    fetchRows("message", "created_at", (q) =>
      applyPeriod(q.eq("organization_id", orgId), trendStart)
    ),

    /**
     * Vai buscar as datas das mensagens falhadas.
     *
     * Só queremos mensagens que tenham failed_at preenchido.
     *
     * Aqui o filtro de período usa a coluna failed_at,
     * porque estamos a medir quando a mensagem falhou.
     */
    fetchRows("message", "failed_at", (q) =>
      applyPeriod(
        q.eq("organization_id", orgId).not("failed_at", "is", null),
        trendStart,
        "failed_at"
      )
    ),

    /**
     * Vai buscar as datas das automações processadas.
     *
     * Só queremos execuções que tenham processed_at preenchido.
     *
     * Aqui o filtro de período usa a coluna processed_at,
     * porque estamos a medir quando a automação foi processada.
     */
    fetchRows("automation_run", "processed_at", (q) =>
      applyPeriod(
        q.eq("organization_id", orgId).not("processed_at", "is", null),
        trendStart,
        "processed_at"
      )
    ),

    /**
     * Vai buscar as datas dos cliques em links rastreados.
     *
     * Esta lógica está no repo dos tracked links porque primeiro
     * é preciso descobrir quais são os links da organização.
     */
    getTrackedLinkClickRows(orgId, trendStart),
  ]);

  /**
   * Devolve as linhas agrupadas por tipo.
   *
   * A service depois transforma cada grupo numa série diária:
   * - messageRows → mensagens por dia
   * - failedMessageRows → falhas por dia
   * - automationProcessedRows → automações processadas por dia
   * - clickRows → cliques por dia
   */
  return {
    messageRows,
    failedMessageRows,
    automationProcessedRows,
    clickRows,
  };
}