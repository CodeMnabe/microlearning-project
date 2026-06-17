import {
  applyPeriod,
  sortAndLimit,
} from "@/lib/helpers/analytics.helpers";

import {
  countRows,
  fetchRows,
} from "./analyticsBase.repo";

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