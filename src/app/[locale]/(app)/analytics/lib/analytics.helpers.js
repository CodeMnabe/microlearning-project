/** Etiquetas e nomes dos ficheiros da exportacao Analytics. */
export function buildExcelLabels(translation) {
  const metricKeys = [
    "total",
    "withAssistant",
    "withoutAssistant",
    "withEmail",
    "withPhone",
    "withTeams",
    "withWhatsapp",
    "withoutOpenAiId",
    "whatsapp",
    "teams",
    "fromUser",
    "fromAssistant",
    "delivered",
    "read",
    "failed",
    "rulesTotal",
    "rulesActive",
    "rulesPaused",
    "runsTotal",
    "runsProcessed",
    "runsFailed",
    "queued",
    "completed",
    "recipients",
    "active",
    "pending",
    "rejected",
    "linksTotal",
    "clicksTotal",
  ];

  const groupKeys = [
    "users",
    "assistants",
    "messages",
    "automations",
    "scheduled",
    "templates",
    "trackedLinks",
    "pendingOutreach",
  ];

  const fromKeys = (keys, prefix) =>
    Object.fromEntries(keys.map((key) => [key, translation(`${prefix}.${key}`)]));

  const panelKeys = ["messages", "operations", "templates"];

  const detailKeys = [
    "messagesSheet",
    "usersSheet",
    "runsSheet",
    "scheduledSheet",
    "linksSheet",
    "id",
    "name",
    "email",
    "phone",
    "channel",
    "role",
    "status",
    "deliveryStatus",
    "createdAt",
    "deliveredAt",
    "readAt",
    "failedAt",
    "scheduledFor",
    "processedAt",
    "startedAt",
    "completedAt",
    "lastError",
    "userId",
    "assistantId",
    "threadId",
    "scheduledBroadcastId",
    "automationRunId",
    "sendGroupId",
    "whatsappId",
    "teamsId",
    "tags",
    "recipients",
    "clicked",
    "clicksTotal",
    "clickRate",
    "linkLabel",
    "destinationUrl",
    "assistant",
    "rule",
    "templatesSheet",
    "dailySheet",
    "language",
    "scope",
    "providerTemplateId",
    "date",
    "failures",
  ];

  return {
    title: translation("excel.title"),
    summarySheet: translation("excel.summarySheet"),
    dashboardSheet: translation("excel.dashboardSheet"),
    panels: fromKeys(panelKeys, "excel.panels"),
    detail: fromKeys(detailKeys, "excel.detail"),
    organization: translation("excel.organization"),
    period: translation("excel.period"),
    exportedAt: translation("excel.exportedAt"),
    columnGroup: translation("excel.columnGroup"),
    columnMetric: translation("excel.columnMetric"),
    columnValue: translation("excel.columnValue"),
    columnRate: translation("excel.columnRate"),
    groups: fromKeys(groupKeys, "excel.groups"),
    metrics: fromKeys(metricKeys, "excel.metrics"),
  };
}

/**
 * Nome do ficheiro Excel.
 *
 * Fica separado porque é a única parte do nome que muda com o período
 * e a data — e é o que o utilizador vê na pasta de transferências.
 */
export function buildExcelFileName(period, date) {
  return `analytics-${period}-${date.toISOString().slice(0, 10)}.xlsx`;
}
