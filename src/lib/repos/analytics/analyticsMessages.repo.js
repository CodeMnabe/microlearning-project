import { applyPeriod } from "@/lib/helpers/analytics.helpers";
import { countRows } from "./analyticsBase.repo";

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