// ==============================
// Period options
// ==============================

export const PERIOD_OPTIONS = [
  { value: "all", labelKey: "periods.all" },
  { value: "7d", labelKey: "periods.last7Days" },
  { value: "30d", labelKey: "periods.last30Days" },
  { value: "90d", labelKey: "periods.last90Days" },
];

// ==============================
// Local storage keys
// ==============================

export const METRIC_GROUP_STORAGE_KEY =
  "analytics.visibleMetricGroups";

export const CHART_SECTION_STORAGE_KEY =
  "analytics.visibleChartSections";

// ==============================
// Default dashboard visibility
// ==============================

export const DEFAULT_VISIBLE_METRIC_GROUPS = {
  overview: true,
  activity: true,
  automations: true,
  engagement: true,
  health: true,
};

export const DEFAULT_VISIBLE_CHART_SECTIONS = {
  distribution: true,
  trends: true,
};