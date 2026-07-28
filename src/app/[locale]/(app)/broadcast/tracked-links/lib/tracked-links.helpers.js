/** Pure formatting, normalization and filtering helpers for Tracked Links. */

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeTrackedLinkReport(item = {}) {
  return {
    ...item,
    recipientCount: safeNumber(item.recipientCount),
    clickedCount: safeNumber(item.clickedCount),
    totalClicks: safeNumber(item.totalClicks),
    clickRate: safeNumber(item.clickRate),
  };
}

export function filterTrackedLinkReports(items, search) {
  const term = normalizeSearchText(search);
  if (!term) return items;

  return items.filter((item) =>
    [
      item.linkLabel,
      item.linkKey,
      item.destinationUrl,
      item.channel,
      item.sourceType,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(term)
  );
}

export function normalizeTrackedLinkDetail(data) {
  if (!data || typeof data !== "object") return null;

  return {
    ...data,
    summary: data.summary ? normalizeTrackedLinkReport(data.summary) : null,
    clicked: safeArray(data.clicked),
    notClicked: safeArray(data.notClicked),
  };
}

export function formatTrackedLinkDate(value, { includeTime = false } = {}) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return includeTime ? date.toLocaleString() : date.toLocaleDateString();
}

export function getTrackedLinkRateTone(rate) {
  const normalizedRate = safeNumber(rate);
  if (normalizedRate >= 70) return "good";
  if (normalizedRate <= 20) return "bad";
  return "neutral";
}

export function getRecipientDisplayName(item = {}) {
  return item.name || item.email || item.phoneNumber || "Unknown recipient";
}
