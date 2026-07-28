import {
  buildDailySeries,
  getAnalyticsPeriodRange,
  withMetricFallback,
} from "./analytics.helpers";

import {
  getUserMetrics,
  getAssistantMetrics,
  getTemplateMetrics,
  getMessageMetrics,
  getAutomationMetrics,
  getScheduledBroadcastMetrics,
  getPendingOutreachMetrics,
  getTrackedLinkMetrics,
  getTopTrackedLinks,
  getTopAutomationFailures,
  getDailyAnalyticsRows,
} from "@/lib/repos/analytics";

/**
 * Função principal da dashboard de Analytics.
 *
 * Esta função:
 * - recebe a organização e o período escolhido;
 * - vai buscar as métricas aos repos;
 * - prepara os dados dos gráficos;
 * - junta tudo no formato esperado pelo frontend.
 * 
 * 
 */
export async function getAnalyticsOverview({ orgId, period }) {
  /**
   * Calcula as datas usadas nas métricas.
   *
   * periodStart:
   * usado para as métricas gerais, como mensagens, automações e envios.
   *
   * trendStart:
   * usado para os gráficos de evolução diária.
   *
   * rankingStart:
   * usado para os rankings.
   */
  const {
    valid: isValidPeriod,
    periodStart,
    trendStart,
    rankingStart,
  } = getAnalyticsPeriodRange(period);

  /**
   * Se o período recebido não for válido,
   * lançamos erro para a route devolver resposta 400.
   */
  if (!isValidPeriod) {
    const error = new Error("Invalid period");
    error.status = 400;
    throw error;
  }

  /**
   * Vai buscar as métricas principais em paralelo.
   *
   * Usamos Promise.all para correr várias queries ao mesmo tempo
   * e tornar a API mais rápida.
   */
  const [
    userMetrics,
    assistantMetrics,
    templateMetrics,
    messageMetrics,
    automationMetrics,
    scheduledBroadcastMetrics,
    pendingOutreachMetrics,
    trackedLinks,
  ] = await Promise.all([
    /**
     * Métricas dos utilizadores:
     * total, com assistente, email, telefone, Teams e WhatsApp.
     */
    getUserMetrics(orgId),

    /**
     * Métricas dos assistentes:
     * total e assistentes sem OpenAI ID configurado.
     */
    getAssistantMetrics(orgId),

    /**
     * Métricas dos templates WhatsApp:
     * total, ativos, pendentes e rejeitados.
     */
    getTemplateMetrics(orgId),

    /**
     * Métricas das mensagens:
     * total, canais, roles, entregues, lidas e falhadas.
     */
    getMessageMetrics(orgId, periodStart),

    /**
     * Métricas das automações:
     * regras, execuções, processadas e falhadas.
     */
    getAutomationMetrics(orgId, periodStart),

    /**
     * Métricas das mensagens agendadas:
     * total, em fila, concluídas, falhadas e destinatários.
     */
    getScheduledBroadcastMetrics(orgId, periodStart),

    /**
     * Métricas de pending outreach:
     * total e ativos.
     */
    getPendingOutreachMetrics(orgId, periodStart),

    /**
     * Métricas dos links rastreados.
     *
     * Esta métrica tem fallback porque é complementar.
     * Se falhar, a dashboard continua a funcionar.
     */
    withMetricFallback(
      "tracked link metrics",
      getTrackedLinkMetrics(orgId, periodStart),
      {
        totalLinks: 0,
        totalClicks: 0,
      }
    ),
  ]);

  /**
   * Vai buscar os dados usados nos gráficos de evolução diária.
   *
   * Exemplo:
   * - mensagens por dia;
   * - mensagens falhadas por dia;
   * - automações processadas por dia;
   * - cliques por dia.
   *
   * Tem fallback para evitar quebrar a dashboard se alguma query falhar.
   */
  const dailyRows = await withMetricFallback(
    "daily analytics rows",
    getDailyAnalyticsRows(orgId, trendStart),
    {
      messageRows: [],
      failedMessageRows: [],
      automationProcessedRows: [],
      clickRows: [],
    }
  );

  /**
   * Vai buscar os rankings da dashboard.
   *
   * topTrackedLinks:
   * links mais clicados.
   *
   * topAutomationFailures:
   * automações com mais falhas.
   */
  const [topTrackedLinks, topAutomationFailures] = await Promise.all([
    withMetricFallback(
      "top tracked links",
      getTopTrackedLinks(orgId, rankingStart),
      []
    ),

    withMetricFallback(
      "top automation failures",
      getTopAutomationFailures(orgId, rankingStart),
      []
    ),
  ]);

  /**
   * Constrói a série diária de mensagens.
   *
   * Transforma várias linhas da base de dados num array por dia,
   * já pronto para o gráfico.
   */
  const dailyMessages = buildDailySeries(
    trendStart,
    dailyRows.messageRows,
    "created_at",
    "messages"
  );

  /**
   * Constrói a série diária de mensagens falhadas.
   */
  const dailyFailedMessages = buildDailySeries(
    trendStart,
    dailyRows.failedMessageRows,
    "failed_at",
    "failures"
  );

  /**
   * Constrói a série diária de automações processadas.
   */
  const dailyAutomationRuns = buildDailySeries(
    trendStart,
    dailyRows.automationProcessedRows,
    "processed_at",
    "processed"
  );

  /**
   * Constrói a série diária de cliques em links rastreados.
   */
  const dailyClicks = buildDailySeries(
    trendStart,
    dailyRows.clickRows,
    "created_at",
    "clicks"
  );

  /**
   * Devolve o objeto final usado pelo frontend.
   *
   * A route recebe este objeto e transforma-o em JSON com NextResponse.json().
   */
  return {
    ok: true,

    /**
     * Informação sobre o período selecionado.
     */
    period: {
      value: period,
      startDate: periodStart,
    },

    /**
     * Métricas dos utilizadores.
     */
    users: userMetrics,

    /**
     * Métricas dos assistentes.
     */
    assistants: assistantMetrics,

    /**
     * Métricas dos templates WhatsApp.
     */
    templates: templateMetrics,

    /**
     * Métricas das mensagens.
     */
    messages: messageMetrics,

    /**
     * Métricas das automações.
     */
    automations: automationMetrics,

    /**
     * Métricas de pending outreach.
     */
    pendingOutreach: pendingOutreachMetrics,

    /**
     * Métricas das mensagens agendadas.
     */
    scheduledBroadcasts: scheduledBroadcastMetrics,

    /**
     * Métricas dos links rastreados.
     */
    trackedLinks,

    /**
     * Dados usados nos gráficos de evolução diária.
     */
    daily: {
      startDate: trendStart,
      messages: dailyMessages,
      clicks: dailyClicks,
      failedMessages: dailyFailedMessages,
      automationRuns: dailyAutomationRuns,
    },

    /**
     * Rankings usados na dashboard.
     */
    rankings: {
      topTrackedLinks,
      topAutomationFailures,
    },
  };
}