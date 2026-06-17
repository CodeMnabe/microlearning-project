import { countRows } from "./analyticsBase.repo";

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