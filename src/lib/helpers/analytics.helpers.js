export const VALID_PERIODS = new Set(["all", "7d", "30d", "90d"]);

export function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function sumNumbers(items, key) {
  return items.reduce((sum, item) => {
    const value = Number(item?.[key] ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export function getPeriodStart(period) {
  if (!VALID_PERIODS.has(period)) {
    return {
      valid: false,
      startDate: null,
    };
  }

  if (period === "all") {
    return {
      valid: true,
      startDate: null,
    };
  }


  

  const days = Number(period.replace("d", ""));
  const date = new Date();

  date.setDate(date.getDate() - days);

  return {
    valid: true,
    startDate: date.toISOString(),
  };
}

export function applyPeriod(query, periodStart, dateColumn = "created_at") {
  if (!periodStart) return query;

  return query.gte(dateColumn, periodStart);
}

export function getDayKey(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

export function getDayRange(startDate, endDate = new Date()) {
  const days = [];

  const current = new Date(startDate);
  current.setUTCHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);

  while (current <= end) {
    days.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

export function buildDailySeries(startDate, rows, dateColumn, valueKey) {
  const countsByDay = Object.fromEntries(
    getDayRange(startDate).map((day) => [day, 0])
  );

  rows.forEach((row) => {
    const day = getDayKey(row?.[dateColumn]);

    if (day && day in countsByDay) {
      countsByDay[day] += 1;
    }
  });

  return Object.entries(countsByDay).map(([date, value]) => ({
    date,
    [valueKey]: value,
  }));
}

export function safeNumberForApi(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function sortAndLimit(items, key, limit = 5) {
  return [...items]
    .sort((a, b) => safeNumberForApi(b[key]) - safeNumberForApi(a[key]))
    .slice(0, limit);
}

export async function withMetricFallback(label, promise, fallback) {
  try {
    return await promise;
  } catch (err) {
    console.warn(`[analytics] ${label} failed:`, err);
    return fallback;
  }
}

export function getAnalyticsPeriodRange(period){
  const {valid, startDate} = getPeriodStart(period);
  const { startDate: defaultTrendStart} = getPeriodStart("90d");

  const periodStart = startDate;
  const trendStart=periodStart || defaultTrendStart;
  const rankingStart = periodStart;

  return {
    valid,
    periodStart: startDate,
    trendStart,
    rankingStart,
  };
}
