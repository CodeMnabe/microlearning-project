import { getSupabaseAdminClient } from "@/lib/db/admin";

import {
  applyPeriod,
  
  sortAndLimit,
} from "@/lib/helpers/analytics.helpers";

export async function countRows(table, applyFilters) {
  const supabaseAdmin = getSupabaseAdminClient();

  let query = supabaseAdmin
    .from(table)
    .select("*", { count: "exact", head: true });

  if (typeof applyFilters === "function") {
    query = applyFilters(query);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return count ?? 0;
}

export async function fetchRows(table, columns, applyFilters) {
  const supabaseAdmin = getSupabaseAdminClient();

  let query = supabaseAdmin.from(table).select(columns);

  if (typeof applyFilters === "function") {
    query = applyFilters(query);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return data ?? [];
}

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

export async function getTopAutomationFailures(orgId, periodStart) {
  const failedRuns = await fetchRows(
    "automation_run",
    "rule_id, last_error, created_at",
    (q) =>
      applyPeriod(
        q.eq("organization_id", orgId).not("last_error", "is", null),
        periodStart
      )
  );

  if (failedRuns.length === 0) {
    return [];
  }

  const rules = await fetchRows("automation_rule", "id, name", (q) =>
    q.eq("organization_id", orgId)
  );

  const ruleNameById = rules.reduce((acc, rule) => {
    acc[rule.id] = rule.name;
    return acc;
  }, {});

  const failuresByRuleId = failedRuns.reduce((acc, run) => {
    const ruleId = run.rule_id || "unknown";

    if (!acc[ruleId]) {
      acc[ruleId] = {
        id: ruleId,
        name: ruleNameById[ruleId] || "Unknown automation",
        failures: 0,
        lastError: "",
      };
    }

    acc[ruleId].failures += 1;

    if (run.last_error) {
      acc[ruleId].lastError = run.last_error;
    }

    return acc;
  }, {});

  return sortAndLimit(Object.values(failuresByRuleId), "failures");
}




