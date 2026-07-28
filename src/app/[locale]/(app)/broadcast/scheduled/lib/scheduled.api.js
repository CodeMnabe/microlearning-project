/**
 * Camada de acesso à API da página de broadcasts agendados.
 *
 * Concentra as chamadas HTTP usadas por esta sub-rota, para que a página
 * e o hook não repitam a construção de URLs nem o tratamento de erros.
 *
 * Regras desta camada:
 * - não conhece React: não gere estado, alertas nem traduções;
 * - devolve os dados já convertidos de JSON, sem os normalizar
 *   (a normalização fica em `scheduled.helpers` e `recipient.helpers`);
 * - em caso de falha lança `Error` com a melhor mensagem disponível.
 */

const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * Os pedidos de leitura usam `no-store` para a lista refletir sempre
 * o estado atual dos agendamentos.
 */
const NO_STORE = { cache: "no-store" };

/**
 * Lê o corpo da resposta uma única vez e tenta interpretá-lo como JSON.
 *
 * O corpo só pode ser lido uma vez, por isso é lido como texto e só
 * depois convertido. Assim continua a ser possível aproveitar respostas
 * de erro que não sejam JSON válido.
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
 */
async function request(url, options, fallbackMessage) {
  const response = options ? await fetch(url, options) : await fetch(url);
  const { text, data } = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(
      data?.error ||
        text ||
        fallbackMessage ||
        `Request failed (${response.status})`,
    );
  }

  return data;
}

/**
 * Obtém os broadcasts agendados manualmente da organização.
 *
 * Os agendamentos criados por automações são excluídos pela própria API,
 * através de `source=manual`.
 */
export function fetchScheduledBroadcasts(orgId) {
  const query = new URLSearchParams({
    orgId: String(orgId),
    source: "manual",
  });

  return request(
    `/api/scheduled-broadcasts?${query}`,
    { method: "GET", ...NO_STORE },
    "Failed to load scheduled broadcasts.",
  );
}

/**
 * Obtém os utilizadores da organização, usados na edição de destinatários.
 *
 * A página precisa da lista completa, por isso pede uma página grande.
 */
export function fetchOrgUsers(orgId) {
  const query = new URLSearchParams({
    orgId: String(orgId),
    page: "1",
    pageSize: "1000",
  });

  return request(`/api/users?${query}`, NO_STORE, "Failed to load users.");
}

/**
 * Atualiza um broadcast agendado.
 */
export function updateScheduledBroadcast(broadcastId, body) {
  return request(
    `/api/scheduled-broadcasts/${encodeURIComponent(broadcastId)}`,
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    },
    "Failed to update scheduled broadcast.",
  );
}

/**
 * Remove um broadcast agendado.
 */
export function deleteScheduledBroadcast(broadcastId) {
  return request(
    `/api/scheduled-broadcasts/${encodeURIComponent(broadcastId)}`,
    { method: "DELETE" },
    "Failed to delete scheduled broadcast",
  );
}
