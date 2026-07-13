import {
  applyPeriod,
  sortAndLimit,
} from "@/lib/helpers/analytics.helpers";

import {
  countRows,
  fetchRows,
} from "./analyticsBase.repo";

/**
 * Vai buscar métricas gerais das automações da organização.
 *
 * Devolve:
 * - total de regras de automação;
 * - regras ativas;
 * - regras pausadas;
 * - total de execuções;
 * - execuções processadas;
 * - execuções com erro.
 */

export async function getAutomationMetrics(orgId, periodStart) {
  /**
   * Executa várias contagens em paralelo para melhorar a performance.
   */
  const [
    rulesTotal,
    rulesActive,
    runsTotal,
    runsProcessed,
    runsFailed,
  ] = await Promise.all([
    /**
     * Conta todas as regras de automação da organização.
     */
    countRows("automation_rule", (q) => q.eq("organization_id", orgId)),

    /**
     * Conta apenas as regras de automação ativas.
     */
    countRows("automation_rule", (q) =>
      q.eq("organization_id", orgId).eq("is_active", true)
    ),

    /**
     * Conta todas as execuções de automação dentro do período selecionado.
     */
    countRows("automation_run", (q) =>
      applyPeriod(q.eq("organization_id", orgId), periodStart)
    ),

    /**
     * Conta execuções que já foram processadas.
     *
     * Uma execução processada tem processed_at preenchido.
     */
    countRows("automation_run", (q) =>
      applyPeriod(
        q.eq("organization_id", orgId).not("processed_at", "is", null),
        periodStart
      )
    ),

    /**
     * Conta execuções que tiveram erro.
     *
     * Uma execução com erro tem last_error preenchido.
     */
    countRows("automation_run", (q) =>
      applyPeriod(
        q.eq("organization_id", orgId).not("last_error", "is", null),
        periodStart
      )
    ),
  ]);

  /**
   * Devolve as métricas já no formato esperado pela dashboard.
   *
   * rulesPaused é calculado:
   * total de regras - regras ativas.
   *
   * Math.max evita valores negativos caso haja algum dado inconsistente.
   */
  return {
    rulesTotal,
    rulesActive,
    rulesPaused: Math.max(0, rulesTotal - rulesActive),
    runsTotal,
    runsProcessed,
    runsFailed,
  };
}

/**
 * Vai buscar o ranking das automações com mais falhas.
 *
 * A ideia é:
 * - buscar execuções com erro;
 * - agrupar por regra de automação;
 * - contar quantas falhas cada regra teve;
 * - ordenar pelas que falharam mais.
 */
export async function getTopAutomationFailures(orgId, periodStart) {
  /**
   * Vai buscar todas as execuções com erro dentro do período selecionado.
   *
   * Precisamos de:
   * - rule_id para saber a regra associada;
   * - last_error para mostrar o último erro;
   * - created_at para permitir aplicar o filtro de período.
   */
  const failedRuns = await fetchRows(
    "automation_run",
    "rule_id, last_error, created_at",
    (q) =>
      applyPeriod(
        q.eq("organization_id", orgId).not("last_error", "is", null),
        periodStart
      )
  );

  /**
   * Se não houver falhas, devolvemos uma lista vazia.
   */
  if (failedRuns.length === 0) {
    return [];
  }

  /**
   * Vai buscar as regras de automação para obter o nome de cada regra.
   */
  const rules = await fetchRows("automation_rule", "id, name", (q) =>
    q.eq("organization_id", orgId)
  );

  /**
   * Cria um mapa para encontrar rapidamente o nome da regra pelo ID.
   *
   * Exemplo:
   * {
   *   "123": "Enviar mensagem de boas-vindas"
   * }
   */
  const ruleNameById = rules.reduce((acc, rule) => {
    acc[rule.id] = rule.name;

    return acc;
  }, {});

  /**
   * Agrupa as falhas por rule_id.
   *
   * No final, cada regra fica com:
   * - id;
   * - name;
   * - número de falhas;
   * - último erro encontrado.
   */
  const failuresByRuleId = failedRuns.reduce((acc, run) => {
    /**
     * Se a execução não tiver rule_id, usamos "unknown"
     * para não perder essa falha.
     */
    const ruleId = run.rule_id || "unknown";

    /**
     * Se esta regra ainda não existe no acumulador,
     * criamos a estrutura inicial.
     */
    if (!acc[ruleId]) {
      acc[ruleId] = {
        id: ruleId,
        name: ruleNameById[ruleId] || "Unknown automation",
        failures: 0,
        lastError: "",
      };
    }

    /**
     * Incrementa o número de falhas desta regra.
     */
    acc[ruleId].failures += 1;

    /**
     * Guarda o último erro encontrado para esta regra.
     */
    if (run.last_error) {
      acc[ruleId].lastError = run.last_error;
    }

    return acc;
  }, {});

  /**
   * Converte o objeto agrupado em array,
   * ordena por número de falhas
   * e limita ao top definido em sortAndLimit.
   */
  return sortAndLimit(Object.values(failuresByRuleId), "failures");
}