import { countRows } from "./analyticsBase.repo";

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