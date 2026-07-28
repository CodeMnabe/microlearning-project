import {
  applyPeriod,
  sortAndLimit,
} from "./analytics.helpers";

import {
  countRows,
  fetchRows,
} from "./analyticsBase.repo";

/**
 * Vai buscar métricas gerais dos links rastreados da organização.
 *
 * Devolve:
 * - total de links rastreados;
 * - total de cliques nesses links dentro do período selecionado.
 */

export async function getTrackedLinkMetrics(orgId, periodStart) {
  /**
   * Primeiro vamos buscar todos os links rastreados da organização.
   *
   * Só precisamos do id porque depois usamos esses ids
   * para procurar os eventos de clique.
   */
  const trackedLinks = await fetchRows("tracked_link", "id", (q) =>
    q.eq("org_id", orgId)
  );

  /**
   * Extrai apenas os IDs dos links.
   */
  const trackedLinkIds = trackedLinks.map((link) => link.id);

  /**
   * Se a organização não tiver links rastreados,
   * devolvemos logo valores a zero.
   *
   * Isto evita fazer uma query desnecessária aos eventos.
   */
  if (trackedLinkIds.length === 0) {
    return {
      totalLinks: 0,
      totalClicks: 0,
    };
  }

  /**
   * Conta todos os eventos de clique associados aos links da organização.
   *
   * O filtro de período é aplicado aos eventos,
   * porque queremos contar cliques dentro do período selecionado.
   */
  const totalClicks = await countRows("tracked_link_event", (q) =>
    applyPeriod(
      q.eq("event_type", "click").in("tracked_link_id", trackedLinkIds),
      periodStart
    )
  );

  /**
   * Devolve as métricas no formato usado pela dashboard.
   */
  return {
    totalLinks: trackedLinkIds.length,
    totalClicks,
  };
}

/**
 * Vai buscar as linhas de cliques usadas nos gráficos diários.
 *
 * Esta função não monta o gráfico.
 * Apenas devolve as datas dos cliques.
 *
 * Depois a service usa buildDailySeries para transformar isto
 * numa série diária.
 */
export async function getTrackedLinkClickRows(orgId, trendStart) {
  /**
   * Vai buscar os links rastreados da organização.
   */
  const trackedLinks = await fetchRows("tracked_link", "id", (q) =>
    q.eq("org_id", orgId)
  );

  /**
   * Extrai os IDs dos links.
   */
  const trackedLinkIds = trackedLinks.map((link) => link.id);

  /**
   * Se não existirem links, não existem cliques para contar.
   */
  if (trackedLinkIds.length === 0) {
    return [];
  }

  /**
   * Vai buscar apenas a data de criação dos eventos de clique.
   *
   * Estes dados são usados para construir o gráfico de cliques por dia.
   */
  return fetchRows("tracked_link_event", "created_at", (q) =>
    applyPeriod(
      q.eq("event_type", "click").in("tracked_link_id", trackedLinkIds),
      trendStart
    )
  );
}

/**
 * Vai buscar o ranking dos links mais clicados.
 *
 * A lógica é:
 * - buscar os links da organização;
 * - buscar os eventos de clique desses links;
 * - contar cliques por link;
 * - ordenar por número de cliques;
 * - devolver o top 10.
 */
export async function getTopTrackedLinks(orgId, periodStart) {
  /**
   * Vai buscar os links rastreados da organização.
   *
   * Precisamos de:
   * - id para ligar aos eventos;
   * - link_label para mostrar nome amigável;
   * - destination_url para fallback se não houver label.
   */
  const trackedLinks = await fetchRows(
    "tracked_link",
    "id, link_label, destination_url",
    (q) => q.eq("org_id", orgId)
  );

  /**
   * Extrai os IDs dos links.
   */
  const trackedLinkIds = trackedLinks.map((link) => link.id);

  /**
   * Se não existirem links, devolvemos ranking vazio.
   */
  if (trackedLinkIds.length === 0) {
    return [];
  }

  /**
   * Vai buscar todos os eventos de clique associados aos links da organização.
   *
   * O filtro de período é aplicado aos eventos,
   * porque queremos saber quais links foram clicados nesse intervalo.
   */
  const clickEvents = await fetchRows(
    "tracked_link_event",
    "tracked_link_id, created_at",
    (q) =>
      applyPeriod(
        q.eq("event_type", "click").in("tracked_link_id", trackedLinkIds),
        periodStart
      )
  );

  /**
   * Agrupa os cliques por tracked_link_id.
   *
   * Exemplo de resultado:
   * {
   *   "link-1": 12,
   *   "link-2": 5
   * }
   */
  const clicksByLinkId = clickEvents.reduce((acc, event) => {
    const linkId = event.tracked_link_id;

    /**
     * Se o evento não tiver link associado,
     * ignoramos esse evento.
     */
    if (!linkId) return acc;

    /**
     * Incrementa o número de cliques deste link.
     */
    acc[linkId] = (acc[linkId] || 0) + 1;

    return acc;
  }, {});

  /**
   * Junta os dados dos links com a contagem de cliques.
   *
   * Se o link não tiver label, usamos a destination_url.
   * Se também não tiver URL, usamos "Link".
   */
  const ranking = trackedLinks.map((link) => ({
    id: link.id,
    label: link.link_label || link.destination_url || "Link",
    destinationUrl: link.destination_url,
    clicks: clicksByLinkId[link.id] || 0,
  }));

  /**
   * Remove links sem cliques,
   * ordena por número de cliques
   * e limita ao top 10.
   */
  return sortAndLimit(
    ranking.filter((item) => item.clicks > 0),
    "clicks",
    10
  );
}