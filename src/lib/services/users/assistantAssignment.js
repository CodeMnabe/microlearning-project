// Assistentes atribuídos a um utilizador e qual deles está ativo (#131).
// O ativo (user.assistant_id) é sempre um dos atribuídos (user_assistant).

function toIds(values) {
  return [...new Set((values || []).map(Number).filter(Boolean))];
}

/**
 * Decide a lista de atribuídos e o ativo a partir do pedido.
 *
 * - `assistantIds` definido: substitui a lista. O ativo é o `assistantId`
 *   pedido; sem ele mantém-se o atual se continuar na lista, senão passa o
 *   primeiro da lista (ou nenhum).
 * - só `assistantId`: muda o ativo e junta-o à lista; `null` deixa o
 *   utilizador sem assistentes.
 *
 * Devolve `null` quando o pedido não mexe em assistentes e lança um erro com
 * `status: 400` quando o ativo pedido não está na lista.
 */
export function resolveAssistantAssignment({
  currentIds = [],
  currentActiveId = null,
  assistantIds,
  assistantId,
}) {
  if (assistantIds === undefined && assistantId === undefined) return null;

  const requestedActive = assistantId == null ? null : Number(assistantId);

  if (assistantIds === undefined) {
    if (requestedActive == null) return { ids: [], activeId: null };

    return {
      ids: toIds([...currentIds, requestedActive]),
      activeId: requestedActive,
    };
  }

  const ids = toIds(assistantIds);

  if (assistantId !== undefined && requestedActive != null) {
    if (!ids.includes(requestedActive)) {
      const err = new Error("Active assistant must be one of assistantIds");
      err.status = 400;
      throw err;
    }

    return { ids, activeId: requestedActive };
  }

  const current = currentActiveId == null ? null : Number(currentActiveId);
  const keepsCurrent = current != null && ids.includes(current);

  return { ids, activeId: keepsCurrent ? current : (ids[0] ?? null) };
}
