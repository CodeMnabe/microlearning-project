import {
  applyPeriod,
  sumNumbers,
} from "@/lib/helpers/analytics.helpers";

import { fetchRows } from "./analyticsBase.repo";

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