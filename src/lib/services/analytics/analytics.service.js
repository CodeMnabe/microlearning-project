import {
  
buildDailySeries,
getAnalyticsPeriodRange,
withMetricFallback,
} from "@/lib/helpers/analytics.helpers";


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

export async function getAnalyticsOverview({ orgId, period }) {
  const {
    valid: isValidPeriod,
    periodStart,
    trendStart,
    rankingStart,
  } = getAnalyticsPeriodRange(period);

  if (!isValidPeriod) {
    const error = new Error("Invalid period");
    error.status = 400;
    throw error;
  }

    /**
     * Executa as métricas principais em paralelo.
     * Isto melhora a performance porque as queries não correm uma a uma.
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
       getUserMetrics(orgId),


        getAssistantMetrics(orgId),

        getTemplateMetrics(orgId),

        getMessageMetrics(orgId, periodStart),

        getAutomationMetrics(orgId, periodStart),

        getScheduledBroadcastMetrics(orgId,periodStart),

        getPendingOutreachMetrics(orgId, periodStart),

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
     * Vai buscar dados usados nos gráficos de evolução diária.
     * Estas métricas têm fallback para não quebrar a dashboard toda.
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
     * Vai buscar rankings principais da dashboard.
     * Também usam fallback porque são métricas complementares.
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
     * Constrói séries diárias para os gráficos de linha.
     */
        const dailyMessages = buildDailySeries(
        trendStart,
        dailyRows.messageRows,
        "created_at",
        "messages"
        );

        const dailyFailedMessages = buildDailySeries(
        trendStart,
        dailyRows.failedMessageRows,
        "failed_at",
        "failures"
        );

        const dailyAutomationRuns = buildDailySeries(
        trendStart,
        dailyRows.automationProcessedRows,
        "processed_at",
        "processed"
        );

        const dailyClicks = buildDailySeries(
        trendStart,
        dailyRows.clickRows,
        "created_at",
        "clicks"
        );

    return {
        ok: true,

        period:{
            value:period,
            startDate: periodStart,
        },


        users: userMetrics,
            assistants: assistantMetrics,

            templates: templateMetrics,

            messages: messageMetrics,

            automations: automationMetrics,

            pendingOutreach: pendingOutreachMetrics,

            scheduledBroadcasts: scheduledBroadcastMetrics,

  

        trackedLinks,

        daily: {
            startDate: trendStart,
            messages: dailyMessages,
            clicks: dailyClicks,
            failedMessages: dailyFailedMessages,
            automationRuns: dailyAutomationRuns,
        },

        rankings: {
            topTrackedLinks,
            topAutomationFailures,
        },
        };
}