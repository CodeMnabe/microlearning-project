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