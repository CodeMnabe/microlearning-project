/**
 * Helpers usados pelos repositórios de Analytics.
 *
 * Reúne funções puras aplicadas junto do acesso aos dados:
 * - aplicar filtros de período às queries Supabase;
 * - validar valores preenchidos;
 * - somar e ordenar valores devolvidos pelas queries.
 *
 * Os helpers de apresentação e de agregação temporal ficam em
 * `services/analytics/analytics.helpers`, porque pertencem à camada
 * que constrói a resposta da dashboard.
 */

/**
 * Verifica se um valor está preenchido.
 *
 * Evita tratar null, undefined ou strings vazias como valores válidos.
 */
export function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

/**
 * Soma valores numéricos de uma lista usando uma chave.
 *
 * Valores inválidos são tratados como 0.
 */
export function sumNumbers(items, key) {
  return items.reduce((sum, item) => {
    const value = Number(item?.[key] ?? 0);

    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

/**
 * Aplica filtro temporal a uma query Supabase.
 *
 * Se não existir periodStart, devolve a query sem alterações.
 */
export function applyPeriod(query, periodStart, dateColumn = "created_at") {
  if (!periodStart) return query;

  return query.gte(dateColumn, periodStart);
}

/**
 * Converte um valor para número seguro.
 *
 * Valores inválidos devolvem 0.
 */
export function safeNumberForApi(value) {
  const number = Number(value ?? 0);

  return Number.isFinite(number) ? number : 0;
}

/**
 * Ordena uma lista por uma chave numérica e limita resultados.
 *
 * Usado em rankings da dashboard.
 */
export function sortAndLimit(items, key, limit = 5) {
  return [...items]
    .sort((a, b) => safeNumberForApi(b[key]) - safeNumberForApi(a[key]))
    .slice(0, limit);
}
