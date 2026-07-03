
/**
 * Constantes locais da dashboard Analytics.
 *
 * Contém opções e valores estáticos usados apenas no frontend
 * desta feature.
 */


// ==============================
// Period options
// ==============================

// Opções disponíveis no seletor de período.
export const PERIOD_OPTIONS = [
  { value: "all", labelKey: "periods.all" },
  { value: "7d", labelKey: "periods.last7Days" },
  { value: "30d", labelKey: "periods.last30Days" },
  { value: "90d", labelKey: "periods.last90Days" },
];

// ==============================
// Local storage keys
// ==============================

// Chaves usadas para persistir preferências visuais no localStorage.
export const METRIC_GROUP_STORAGE_KEY =
  "analytics.visibleMetricGroups";

export const CHART_SECTION_STORAGE_KEY =
  "analytics.visibleChartSections";

// ==============================
// Default dashboard visibility
// ==============================

// Estado inicial dos grupos de métricas quando o utilizador ainda não personalizou a dashboard.
export const DEFAULT_VISIBLE_METRIC_GROUPS = {
  overview: true,
  activity: true,
  automations: true,
  engagement: true,
  health: true,
};

// Estado inicial das secções de gráficos visíveis.
export const DEFAULT_VISIBLE_CHART_SECTIONS = {
  distribution: true,
  trends: true,
};