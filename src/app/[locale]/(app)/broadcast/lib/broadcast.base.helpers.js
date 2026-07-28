/**
 * Funções base partilhadas da camada Broadcast.
 *
 * Funções puras. Sem React, sem fetch, sem JSX.
 */
/**
 * Obtém a inicial de um nome para uso visual na UI.
 *
 * Quando o nome está vazio, devolve "?" como fallback.
 */
export function getInitial(name = "") {
  return (name?.trim()?.[0] || "?").toUpperCase();
}

/**
 * Cria um identificador único para drafts locais.
 *
 * Usa crypto.randomUUID quando disponível e faz fallback
 * para timestamp + valor aleatório.
 */
export function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Garante que uma resposta é tratada como lista.
 *
 * Algumas APIs podem devolver arrays diretamente ou dentro de uma key,
 * como `items`. Este helper normaliza esses formatos para simplificar
 * o consumo nos hooks.
 */
export function asList(data, preferredKey = "items") {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[preferredKey])) return data[preferredKey];
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.users)) return data.users;

  return [];
}

/**
 * Limita um valor numérico entre um mínimo e um máximo.
 *
 * Usado principalmente em inputs de tempo para evitar valores inválidos.
 */
export function clampNumber(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) return min;

  return Math.min(Math.max(Math.floor(number), min), max);
}
