import {
  applyPeriod,
  buildDailySeries,
  getAnalyticsPeriodRange,
  hasValue,
  sumNumbers,
  withMetricFallback,
} from "@/lib/helpers/analytics.helpers";


import {
  countRows,
  fetchRows,
  getTrackedLinkMetrics,
  getTopTrackedLinks,
  getTrackedLinkClickRows,
  getTopAutomationFailures,
} from "@/lib/repos/analytics.repo";

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
      users,
      assistantsTotal,
      assistantsWithoutOpenAiId,
      templatesTotal,
      templatesActive,
      templatesPending,
      templatesRejected,
      messagesTotal,
      whatsappMessages,
      teamsMessages,
      userMessages,
      assistantMessages,
      deliveredMessages,
      readMessages,
      failedMessages,
      automationRulesTotal,
      automationRulesActive,
      automationRunsTotal,
      automationRunsProcessed,
      automationRunsFailed,
      scheduledBroadcastRows,
      pendingOutreachTotal,
      pendingOutreachActive,
      trackedLinks,
    ] = await Promise.all([
      fetchRows(
        "user",
        `
          id,
          assistant_id,
          email,
          phone_number,
          phone_country_code,
          phone_national,
          teams_aad_object_id,
          teams_from_id,
          whatsapp_bsuid,
          bird_contact_id
        `,
        (q) => q.eq("organization_id", orgId)
      ),

      countRows("assistant", (q) => q.eq("organization_id", orgId)),

      countRows("assistant", (q) =>
        q.eq("organization_id", orgId).or("open_ai_id.is.null,open_ai_id.eq.")
      ),

      countRows("whatsapp_templates", (q) =>
        q.or(`org_id.eq.${orgId},org_id.is.null`)
      ),

      countRows("whatsapp_templates", (q) =>
        q
          .or(`org_id.eq.${orgId},org_id.is.null`)
          .in("status", ["ACTIVE", "active", "APPROVED", "approved"])
      ),

      countRows("whatsapp_templates", (q) =>
        q
          .or(`org_id.eq.${orgId},org_id.is.null`)
          .in("status", [
            "PENDING",
            "pending",
            "NEW",
            "new",
            "DRAFT",
            "draft",
            "PENDINGREVIEW",
            "pendingreview",
          ])
      ),

      countRows("whatsapp_templates", (q) =>
        q
          .or(`org_id.eq.${orgId},org_id.is.null`)
          .in("status", ["REJECTED", "rejected", "INACTIVE", "inactive"])
      ),

      countRows("message", (q) =>
        applyPeriod(q.eq("organization_id", orgId), periodStart)
      ),

      countRows("message", (q) =>
        applyPeriod(
          q.eq("organization_id", orgId).eq("channel", "whatsapp"),
          periodStart
        )
      ),

      countRows("message", (q) =>
        applyPeriod(
          q.eq("organization_id", orgId).eq("channel", "teams"),
          periodStart
        )
      ),

      countRows("message", (q) =>
        applyPeriod(
          q.eq("organization_id", orgId).eq("role", "user"),
          periodStart
        )
      ),

      countRows("message", (q) =>
        applyPeriod(
          q.eq("organization_id", orgId).eq("role", "assistant"),
          periodStart
        )
      ),

      countRows("message", (q) =>
        applyPeriod(
          q.eq("organization_id", orgId).not("delivered_at", "is", null),
          periodStart
        )
      ),

      countRows("message", (q) =>
        applyPeriod(
          q.eq("organization_id", orgId).not("read_at", "is", null),
          periodStart
        )
      ),

      countRows("message", (q) =>
        applyPeriod(
          q.eq("organization_id", orgId).not("failed_at", "is", null),
          periodStart
        )
      ),

      countRows("automation_rule", (q) => q.eq("organization_id", orgId)),

      countRows("automation_rule", (q) =>
        q.eq("organization_id", orgId).eq("is_active", true)
      ),

      countRows("automation_run", (q) =>
        applyPeriod(q.eq("organization_id", orgId), periodStart)
      ),

      countRows("automation_run", (q) =>
        applyPeriod(
          q.eq("organization_id", orgId).not("processed_at", "is", null),
          periodStart
        )
      ),

      countRows("automation_run", (q) =>
        applyPeriod(
          q.eq("organization_id", orgId).not("last_error", "is", null),
          periodStart
        )
      ),

      fetchRows(
        "scheduled_broadcast",
        "id, status, channel, recipient_count",
        (q) =>
          applyPeriod(
            q.eq("organization_id", orgId),
            periodStart,
            "scheduled_for"
          )
      ),

      countRows("pending_outreach", (q) =>
        applyPeriod(q.eq("org_id", orgId), periodStart)
      ),

      countRows("pending_outreach", (q) =>
        applyPeriod(
          q.eq("org_id", orgId).in("status", ["pending", "queued", "active"]),
          periodStart
        )
      ),

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
    const [
      dailyMessageRows,
      dailyFailedMessageRows,
      dailyAutomationProcessedRows,
      dailyClickRows,
    ] = await Promise.all([
      withMetricFallback(
        "daily message rows",
        fetchRows("message", "created_at", (q) =>
          applyPeriod(q.eq("organization_id", orgId), trendStart)
        ),
        []
      ),

      withMetricFallback(
        "daily failed message rows",
        fetchRows("message", "failed_at", (q) =>
          applyPeriod(
            q.eq("organization_id", orgId).not("failed_at", "is", null),
            trendStart,
            "failed_at"
          )
        ),
        []
      ),

      withMetricFallback(
        "daily automation processed rows",
        fetchRows("automation_run", "processed_at", (q) =>
          applyPeriod(
            q.eq("organization_id", orgId).not("processed_at", "is", null),
            trendStart,
            "processed_at"
          )
        ),
        []
      ),

      withMetricFallback(
        "daily click rows",
        getTrackedLinkClickRows(orgId, trendStart),
        []
      ),
    ]);

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
     * Calcula métricas derivadas dos utilizadores.
     */
    const totalUsers = users.length;

    const usersWithAssistant = users.filter((user) =>
      hasValue(user.assistant_id)
    ).length;

    const usersWithEmail = users.filter((user) => hasValue(user.email)).length;

    const usersWithPhone = users.filter(
      (user) =>
        hasValue(user.phone_number) ||
        (hasValue(user.phone_country_code) && hasValue(user.phone_national))
    ).length;

    const usersWithTeams = users.filter(
      (user) =>
        hasValue(user.teams_aad_object_id) || hasValue(user.teams_from_id)
    ).length;

    const usersWithWhatsapp = users.filter(
      (user) =>
        hasValue(user.whatsapp_bsuid) ||
        hasValue(user.bird_contact_id) ||
        hasValue(user.phone_number)
    ).length;

    /**
     * Calcula métricas derivadas das mensagens agendadas.
     * Aceita vários nomes de status para ser mais flexível.
     */
    const scheduledBroadcastsTotal = scheduledBroadcastRows.length;

    const scheduledBroadcastsQueued = scheduledBroadcastRows.filter((item) =>
      ["queued", "pending", "scheduled"].includes(
        String(item.status || "").toLowerCase()
      )
    ).length;

    const scheduledBroadcastsCompleted = scheduledBroadcastRows.filter((item) =>
      ["completed", "sent", "done"].includes(
        String(item.status || "").toLowerCase()
      )
    ).length;

    const scheduledBroadcastsFailed = scheduledBroadcastRows.filter((item) =>
      ["failed", "error"].includes(String(item.status || "").toLowerCase())
    ).length;

    const scheduledBroadcastRecipients = sumNumbers(
      scheduledBroadcastRows,
      "recipient_count"
    );

    /**
     * Constrói séries diárias para os gráficos de linha.
     */
    const dailyMessages = buildDailySeries(
      trendStart,
      dailyMessageRows,
      "created_at",
      "messages"
    );

    const dailyFailedMessages = buildDailySeries(
      trendStart,
      dailyFailedMessageRows,
      "failed_at",
      "failures"
    );

    const dailyAutomationRuns = buildDailySeries(
      trendStart,
      dailyAutomationProcessedRows,
      "processed_at",
      "processed"
    );

    const dailyClicks = buildDailySeries(
      trendStart,
      dailyClickRows,
      "created_at",
      "clicks"
    );


    return {
        ok: true,

        period:{
            value:period,
            startDate: periodStart,
        },


        users:{
            total: totalUsers,
            withAssistant: usersWithAssistant,
            withoutAssistant: Math.max(0, totalUsers - usersWithAssistant),
            withEmail: usersWithEmail,
            withPhone: usersWithPhone,
            withTeams: usersWithTeams,
            withWhatsapp: usersWithWhatsapp,
        },

         assistants: {
    total: assistantsTotal,
    withoutOpenAiId: assistantsWithoutOpenAiId,
  },

  templates: {
    total: templatesTotal,
    active: templatesActive,
    pending: templatesPending,
    rejected: templatesRejected,
  },

  messages: {
    total: messagesTotal,
    whatsapp: whatsappMessages,
    teams: teamsMessages,
    userMessages,
    assistantMessages,
    delivered: deliveredMessages,
    read: readMessages,
    failed: failedMessages,
  },

  automations: {
    rulesTotal: automationRulesTotal,
    rulesActive: automationRulesActive,
    rulesPaused: Math.max(0, automationRulesTotal - automationRulesActive),
    runsTotal: automationRunsTotal,
    runsProcessed: automationRunsProcessed,
    runsFailed: automationRunsFailed,
  },

  scheduledBroadcasts: {
    total: scheduledBroadcastsTotal,
    queued: scheduledBroadcastsQueued,
    completed: scheduledBroadcastsCompleted,
    failed: scheduledBroadcastsFailed,
    recipientCount: scheduledBroadcastRecipients,
  },

  pendingOutreach: {
    total: pendingOutreachTotal,
    active: pendingOutreachActive,
  },

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