import { applyPeriod } from "@/lib/helpers/analytics.helpers";
import { fetchRows } from "./analyticsBase.repo";
import { getTrackedLinkClickRows } from "./analyticsTrackedLinks.repo";

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