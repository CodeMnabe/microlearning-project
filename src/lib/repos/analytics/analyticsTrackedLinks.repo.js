import {
  applyPeriod,
  sortAndLimit,
} from "@/lib/helpers/analytics.helpers";

import {
  countRows,
  fetchRows,
} from "./analyticsBase.repo";

export async function getTrackedLinkMetrics(orgId, periodStart) {
  const trackedLinks = await fetchRows("tracked_link", "id", (q) =>
    q.eq("org_id", orgId)
  );

  const trackedLinkIds = trackedLinks.map((link) => link.id);

  if (trackedLinkIds.length === 0) {
    return {
      totalLinks: 0,
      totalClicks: 0,
    };
  }

  const totalClicks = await countRows("tracked_link_event", (q) =>
    applyPeriod(
      q.eq("event_type", "click").in("tracked_link_id", trackedLinkIds),
      periodStart
    )
  );

  return {
    totalLinks: trackedLinkIds.length,
    totalClicks,
  };
}

export async function getTrackedLinkClickRows(orgId, trendStart) {
  const trackedLinks = await fetchRows("tracked_link", "id", (q) =>
    q.eq("org_id", orgId)
  );

  const trackedLinkIds = trackedLinks.map((link) => link.id);

  if (trackedLinkIds.length === 0) {
    return [];
  }

  return fetchRows("tracked_link_event", "created_at", (q) =>
    applyPeriod(
      q.eq("event_type", "click").in("tracked_link_id", trackedLinkIds),
      trendStart
    )
  );
}

export async function getTopTrackedLinks(orgId, periodStart) {
  const trackedLinks = await fetchRows(
    "tracked_link",
    "id, link_label, destination_url",
    (q) => q.eq("org_id", orgId)
  );

  const trackedLinkIds = trackedLinks.map((link) => link.id);

  if (trackedLinkIds.length === 0) {
    return [];
  }

  const clickEvents = await fetchRows(
    "tracked_link_event",
    "tracked_link_id, created_at",
    (q) =>
      applyPeriod(
        q.eq("event_type", "click").in("tracked_link_id", trackedLinkIds),
        periodStart
      )
  );

  const clicksByLinkId = clickEvents.reduce((acc, event) => {
    const linkId = event.tracked_link_id;

    if (!linkId) return acc;

    acc[linkId] = (acc[linkId] || 0) + 1;

    return acc;
  }, {});

  const ranking = trackedLinks.map((link) => ({
    id: link.id,
    label: link.link_label || link.destination_url || "Link",
    destinationUrl: link.destination_url,
    clicks: clicksByLinkId[link.id] || 0,
  }));

  return sortAndLimit(
    ranking.filter((item) => item.clicks > 0),
    "clicks",
    10
  );
}