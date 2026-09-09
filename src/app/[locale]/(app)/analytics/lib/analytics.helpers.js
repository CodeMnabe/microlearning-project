/**
 * Helpers locais da página Analytics.
 *
 * Contém apenas funções de apoio ao frontend:
 * - normalização de números;
 * - cálculo de percentagens;
 * - formatação de datas;
 * - preparação de dados para gráficos.
 *
 * Não confundir com os helpers globais/backend de Analytics.
 */


// ==============================
// Number helpers
// ==============================

/**
 * Converte um valor para número de forma segura.
 *
 * Usado na interface para evitar mostrar NaN.
 */
export function safeNumber(value) {
  const number = Number(value ?? 0);

  return Number.isFinite(number) ? number : 0;
}

/**
 * Calcula uma percentagem de forma segura.
 *
 * Evita erros quando o total é 0.
 */
export function safePercent(part, total) {
  const partNumber = safeNumber(part);
  const totalNumber = safeNumber(total);

  if (totalNumber <= 0) return 0;

  return Math.round((partNumber / totalNumber) * 100);
}

// ==============================
// Date helpers
// ==============================

/**
 * Formata a data dos gráficos diários de acordo com o idioma atual.
 */
export function formatDateLabel(date, locale) {
  const parsedDate = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
  }).format(parsedDate);
}

// ==============================
// Period helpers
// ==============================

/**
 * Devolve a chave de tradução correspondente ao período atual.
 */
export function getPeriodLabelKey(period) {
  if (period === "7d") return "periods.last7Days";
  if (period === "30d") return "periods.last30Days";
  if (period === "90d") return "periods.last90Days";

  return "periods.all";
}

// ==============================
// Chart data helpers
// ==============================

/**
 * Constrói os dados para o gráfico de mensagens por canal.
 */
export function buildMessagesChartData(messages) {
  return [
    {
      name: "WhatsApp",
      value: safeNumber(messages?.whatsapp),
    },
    {
      name: "Teams",
      value: safeNumber(messages?.teams),
    },
  ];
}

/**
 * Constrói os dados para o gráfico de estado dos templates.
 */
export function buildTemplatesChartData(templates, translation) {
  return [
    {
      name: translation("charts.active"),
      value: safeNumber(templates?.active),
    },
    {
      name: translation("charts.pending"),
      value: safeNumber(templates?.pending),
    },
    {
      name: translation("charts.rejected"),
      value: safeNumber(templates?.rejected),
    },
  ];
}
// ==============================
// Excel export helpers
// ==============================

/**
 * Monta as etiquetas do livro Excel a partir das traduções.
 *
 * O construtor do livro (analytics.excel.js) não sabe nada de idiomas:
 * recebe todos os textos já traduzidos. É esta função que faz a ponte,
 * para que a página não fique com dezenas de chamadas ao translation().
 */
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
