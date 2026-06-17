import { applyPeriod } from "@/lib/helpers/analytics.helpers";
import { countRows } from "./analyticsBase.repo";

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