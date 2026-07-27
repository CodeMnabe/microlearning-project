/**
 * Camada de acesso à API da área de utilizadores.
 *
 * Concentra todas as chamadas HTTP usadas pela camada `users`, para que
 * páginas, componentes e hooks não tenham de repetir a construção de URLs,
 * a verificação de `res.ok` nem a leitura da mensagem de erro.
 *
 * Regras desta camada:
 * - não conhece React: não gere estado, alertas nem traduções;
 * - devolve os dados já convertidos de JSON, sem os normalizar
 *   (a normalização é responsabilidade de `users.helpers`);
 * - em caso de falha lança `Error` com a melhor mensagem disponível,
 *   deixando a decisão de como reagir a quem chama.
 */

const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * Lê o corpo da resposta uma única vez e tenta interpretá-lo como JSON.
 *
 * O corpo de uma resposta só pode ser lido uma vez, por isso é lido como
 * texto e só depois convertido. Assim continua a ser possível aproveitar
 * respostas de erro que não sejam JSON válido.
 */
async function readResponseBody(response) {
  const text = await response.text().catch(() => "");

  if (!text) return { text: "", data: null };

  try {
    return { text, data: JSON.parse(text) };
  } catch {
    return { text, data: null };
  }
}

/**
 * Executa um pedido e devolve o corpo já convertido.
 *
 * Quando a resposta não tem sucesso, lança `Error` com a primeira
 * mensagem útil que encontrar: o campo `error` do corpo, o corpo em
 * texto, ou o código de estado.
 */
async function request(url, options) {
  // Um pedido sem opções é chamado com um único argumento, como o `fetch`
  // nativo faria num GET simples.
  const response = options ? await fetch(url, options) : await fetch(url);
  const { text, data } = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(
      data?.error || text || `Request failed (${response.status})`,
    );
  }

  return data;
}

/**
 * Variante para pedidos que enviam um corpo em JSON.
 */
function jsonRequest(url, method, body) {
  return request(url, {
    method,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

/* -------------------------------------------------------------------------- */
/* Utilizadores                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Obtém uma página de utilizadores da organização.
 *
 * Devolve a resposta paginada da API, no formato `{ items, total }`.
 */
export function fetchUsers({ orgId, page, pageSize }) {
  const query = new URLSearchParams({
    orgId: String(orgId),
    page: String(page),
    pageSize: String(pageSize),
  });

  return request(`/api/users?${query}`);
}

export function createUser(payload) {
  return jsonRequest("/api/users", "POST", payload);
}

export function updateUser(payload) {
  return jsonRequest("/api/users", "PATCH", payload);
}

export function deleteUser(userId) {
  return request(`/api/users?id=${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

/* -------------------------------------------------------------------------- */
/* Ações em massa                                                             */
/* -------------------------------------------------------------------------- */

export function bulkSetAssistant({ ids, assistantId, orgId }) {
  return jsonRequest("/api/users/bulk", "PATCH", { ids, assistantId, orgId });
}

export function bulkModifyTags({ ids, tagIds, op, orgId }) {
  return jsonRequest("/api/users/bulk-tags", "POST", {
    ids,
    tagIds,
    op,
    orgId,
  });
}

/**
 * Remove vários utilizadores.
 *
 * A resposta pode incluir `failedCount` e `failed` quando alguns
 * utilizadores não puderam ser removidos.
 */
export function bulkDeleteUsers({ ids, orgId }) {
  return jsonRequest("/api/users/bulk", "DELETE", { ids, orgId });
}

/**
 * Importa utilizadores a partir de um ficheiro já convertido em linhas.
 *
 * Devolve o resumo da importação (criados, atualizados, ignorados, falhados).
 */
export function importUsers({ orgId, users }) {
  return jsonRequest("/api/users/import", "POST", {
    organizationId: orgId,
    users,
  });
}

/* -------------------------------------------------------------------------- */
/* Tags                                                                       */
/* -------------------------------------------------------------------------- */

export function fetchTags(orgId) {
  return request(`/api/tags?orgId=${encodeURIComponent(orgId)}`);
}

export function createTag({ orgId, name }) {
  return jsonRequest("/api/tags", "POST", { orgId, name });
}

export function renameTag({ id, name }) {
  return jsonRequest("/api/tags", "PATCH", { id, name });
}

export function deleteTag(tagId) {
  return request(`/api/tags?id=${encodeURIComponent(tagId)}`, {
    method: "DELETE",
  });
}

/* -------------------------------------------------------------------------- */
/* Assistentes                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Obtém os assistentes da organização, usados nos filtros e na
 * associação de assistente a um utilizador.
 */
export function fetchAssistants(orgId) {
  return request(`/api/assistants?orgId=${encodeURIComponent(orgId)}`);
}

/* -------------------------------------------------------------------------- */
/* Conversas do utilizador                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Obtém as threads de um utilizador, no formato `{ threads }`.
 */
export function fetchUserThreads(userId) {
  return request(`/api/threads?userId=${encodeURIComponent(userId)}`);
}

/**
 * Obtém as mensagens de uma thread.
 *
 * A rota `/api/messages` é a principal. Quando falha, existe uma rota
 * alternativa por thread. O fallback fica concentrado aqui para os
 * componentes não precisarem de conhecer as duas rotas.
 */
export async function fetchThreadMessages(threadId) {
  const encodedThreadId = encodeURIComponent(threadId);

  try {
    return await request(`/api/messages?threadId=${encodedThreadId}`);
  } catch {
    return await request(`/api/threads/${encodedThreadId}/messages`);
  }
}
