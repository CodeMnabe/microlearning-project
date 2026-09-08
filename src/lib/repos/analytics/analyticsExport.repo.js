import { applyPeriod } from "./analytics.helpers";
import { fetchRows } from "./analyticsBase.repo";

/**
 * Repositório das linhas de detalhe usadas na exportação.
 *
 * Ao contrário dos outros repos de analytics, que contam, este devolve
 * linhas: é o que alimenta as folhas onde cada registo é uma linha.
 *
 * Usa o `fetchRows`, e isso não é detalhe. É a função que paginámos
 * para deixar de truncar em silêncio no limite do PostgREST — sem ela,
 * um export de uma organização grande vinha cortado sem dizer nada.
 */

/**
 * Vai buscar as execuções de automação com o nome de quem as originou.
 *
 * Não reutilizamos o `getOrganizationMaterializedAutomationRuns` de
 * propósito. Essa função filtra por `scheduled_broadcast_id not null`
 * e limita a 100 linhas — devolve só as execuções que chegaram a virar
 * mensagem agendada. Numa folha de exportação isso esconderia
 * precisamente as que falharam antes de materializar, que são as que
 * alguém vai lá procurar.
 */
export async function getAutomationRunRows(orgId, periodStart) {
  return fetchRows(
    "automation_run",
    `
      id,
      rule_id,
      user_id,
      status,
      created_at,
      scheduled_for,
      processed_at,
      last_error,
      scheduled_broadcast_id,
      user_row:user!automation_run_user_id_fkey (
        id,
        name,
        email
      )
    `,
    (query) => applyPeriod(query.eq("organization_id", orgId), periodStart),
  );
}

/**
 * Vai buscar os nomes das regras de automação da organização.
 *
 * Serve para trocar o `rule_id` por algo legível na folha. Fica numa
 * chamada separada em vez de uma junção porque as regras são poucas e
 * repetem-se muito: trazê-las uma vez e cruzar em memória é mais barato
 * do que repetir o nome em cada execução.
 */
export async function getAutomationRuleNames(orgId) {
  const rules = await fetchRows("automation_rule", "id, name", (query) =>
    query.eq("organization_id", orgId),
  );

  return new Map(rules.map((rule) => [rule.id, rule.name]));
}

/**
 * Vai buscar as mensagens agendadas da organização.
 *
 * O filtro de período aplica-se a `scheduled_for` e não a `created_at`,
 * para acompanhar o critério que o resto da camada já usa nesta tabela.
 */
export async function getScheduledBroadcastRows(orgId, periodStart) {
  return fetchRows(
    "scheduled_broadcast",
    `
      id,
      status,
      channel,
      scheduled_for,
      recipient_count,
      started_at,
      completed_at,
      created_at,
      updated_at
    `,
    (query) =>
      applyPeriod(
        query.eq("organization_id", orgId),
        periodStart,
        "scheduled_for",
      ),
  );
}
