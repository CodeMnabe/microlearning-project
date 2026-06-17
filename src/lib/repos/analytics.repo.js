import { getSupabaseAdminClient } from "@/lib/db/admin";

import {
  applyPeriod,
  hasValue,
  sumNumbers,
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

export async function getMessageMetrics(orgId, periodStart) {
  const [
    total,
    whatsapp,
    teams,
    userMessages,
    assistantMessages,
    delivered,
    read,
    failed,
  ] = await Promise.all([
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
  ]);

  return {
    total,
    whatsapp,
    teams,
    userMessages,
    assistantMessages,
    delivered,
    read,
    failed,
  };
}


export async function getAssistantMetrics(orgId) {
  const [total, withoutOpenAiId] = await Promise.all([
    countRows("assistant", (q) => q.eq("organization_id", orgId)),

    countRows("assistant", (q) =>
      q.eq("organization_id", orgId).or("open_ai_id.is.null,open_ai_id.eq.")
    ),
  ]);

  return {
    total,
    withoutOpenAiId,
  };
}



export async function getTemplateMetrics(orgId) {
  const templateFilter = `org_id.eq.${orgId},org_id.is.null`;

  const [total, active, pending, rejected] = await Promise.all([
    countRows("whatsapp_templates", (q) => q.or(templateFilter)),

    countRows("whatsapp_templates", (q) =>
      q
        .or(templateFilter)
        .in("status", ["ACTIVE", "active", "APPROVED", "approved"])
    ),

    countRows("whatsapp_templates", (q) =>
      q
        .or(templateFilter)
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
        .or(templateFilter)
        .in("status", ["REJECTED", "rejected", "INACTIVE", "inactive"])
    ),
  ]);

  return {
    total,
    active,
    pending,
    rejected,
  };
}

export async function getAutomationMetrics(orgId, periodStart) {
  const [
    rulesTotal,
    rulesActive,
    runsTotal,
    runsProcessed,
    runsFailed,
  ] = await Promise.all([
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
  ]);

  return {
    rulesTotal,
    rulesActive,
    rulesPaused: Math.max(0, rulesTotal - rulesActive),
    runsTotal,
    runsProcessed,
    runsFailed,
  };
}

export async function getPendingOutreachMetrics(orgId, periodStart) {
  const [total, active] = await Promise.all([
    countRows("pending_outreach", (q) =>
      applyPeriod(q.eq("org_id", orgId), periodStart)
    ),

    countRows("pending_outreach", (q) =>
      applyPeriod(
        q.eq("org_id", orgId).in("status", ["pending", "queued", "active"]),
        periodStart
      )
    ),
  ]);

  return {
    total,
    active,
  };
}

export async function getUserMetrics(orgId) {
  const users = await fetchRows(
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
  );

  const total = users.length;

  const withAssistant = users.filter((user) =>
    hasValue(user.assistant_id)
  ).length;

  const withEmail = users.filter((user) => hasValue(user.email)).length;

  const withPhone = users.filter(
    (user) =>
      hasValue(user.phone_number) ||
      (hasValue(user.phone_country_code) && hasValue(user.phone_national))
  ).length;

  const withTeams = users.filter(
    (user) =>
      hasValue(user.teams_aad_object_id) || hasValue(user.teams_from_id)
  ).length;

  const withWhatsapp = users.filter(
    (user) =>
      hasValue(user.whatsapp_bsuid) ||
      hasValue(user.bird_contact_id) ||
      hasValue(user.phone_number)
  ).length;

  return {
    total,
    withAssistant,
    withoutAssistant: Math.max(0, total - withAssistant),
    withEmail,
    withPhone,
    withTeams,
    withWhatsapp,
  };
}

export async function getScheduledBroadcastMetrics(orgId, periodStart) {
  const rows = await fetchRows(
    "scheduled_broadcast",
    "id, status, channel, recipient_count",
    (q) =>
      applyPeriod(
        q.eq("organization_id", orgId),
        periodStart,
        "scheduled_for"
      )
  );

  const total = rows.length;

  const queued = rows.filter((item) =>
    ["queued", "pending", "scheduled"].includes(
      String(item.status || "").toLowerCase()
    )
  ).length;

  const completed = rows.filter((item) =>
    ["completed", "sent", "done"].includes(
      String(item.status || "").toLowerCase()
    )
  ).length;

  const failed = rows.filter((item) =>
    ["failed", "error"].includes(String(item.status || "").toLowerCase())
  ).length;

  const recipientCount = sumNumbers(rows, "recipient_count");

  return {
    total,
    queued,
    completed,
    failed,
    recipientCount,
  };
}

export async function getDailyAnalyticsRows(orgId, trendStart) {
  const [
    messageRows,
    failedMessageRows,
    automationProcessedRows,
    clickRows,
  ] = await Promise.all([
    fetchRows("message", "created_at", (q) =>
      applyPeriod(q.eq("organization_id", orgId), trendStart)
    ),

    fetchRows("message", "failed_at", (q) =>
      applyPeriod(
        q.eq("organization_id", orgId).not("failed_at", "is", null),
        trendStart,
        "failed_at"
      )
    ),

    fetchRows("automation_run", "processed_at", (q) =>
      applyPeriod(
        q.eq("organization_id", orgId).not("processed_at", "is", null),
        trendStart,
        "processed_at"
      )
    ),

    getTrackedLinkClickRows(orgId, trendStart),
  ]);

  return {
    messageRows,
    failedMessageRows,
    automationProcessedRows,
    clickRows,
  };
}