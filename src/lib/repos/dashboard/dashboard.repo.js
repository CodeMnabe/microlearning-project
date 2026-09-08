import { hasValue } from "@/lib/helpers/analytics.helpers";
import {
  countRows,
  fetchAllRows,
} from "@/lib/repos/analytics/analyticsBase.repo";

export function isWhatsAppConfigured(user) {
  return Boolean(
    hasValue(user?.phone_number) ||
      (hasValue(user?.phone_country_code) && hasValue(user?.phone_national)) ||
      hasValue(user?.whatsapp_bsuid) ||
      hasValue(user?.bird_contact_id),
  );
}

export async function getDashboardUserMetrics(orgId) {
  const users = await fetchAllRows(
    "user",
    [
      "id",
      "teams_aad_object_id",
      "phone_number",
      "phone_country_code",
      "phone_national",
      "whatsapp_bsuid",
      "bird_contact_id",
    ].join(", "),
    (query) => query.eq("organization_id", orgId),
  );

  return {
    total: users.length,
    teamsConfigured: users.filter((user) =>
      hasValue(user.teams_aad_object_id),
    ).length,
    whatsappConfigured: users.filter(isWhatsAppConfigured).length,
  };
}

export async function getChannelUsageMetrics(orgId) {
  const rows = await fetchAllRows(
    "message",
    "user_id, channel",
    (query) =>
      query
        .eq("organization_id", orgId)
        .eq("role", "user")
        .not("user_id", "is", null)
        .in("channel", ["teams", "whatsapp"]),
  );

  const teamsUsers = new Set();
  const whatsappUsers = new Set();

  for (const row of rows) {
    if (row.user_id == null) continue;
    if (row.channel === "teams") teamsUsers.add(row.user_id);
    if (row.channel === "whatsapp") whatsappUsers.add(row.user_id);
  }

  return {
    teamsUsed: teamsUsers.size,
    whatsappUsed: whatsappUsers.size,
  };
}

export async function getDashboardCountMetrics(orgId) {
  const [tags, assistants, automations, active, scheduledMessages] =
    await Promise.all([
      countRows("tags", (query) => query.eq("org_id", orgId)),
      countRows("assistant", (query) => query.eq("organization_id", orgId)),
      countRows("automation_rule", (query) =>
        query.eq("organization_id", orgId),
      ),
      countRows("automation_rule", (query) =>
        query.eq("organization_id", orgId).eq("is_active", true),
      ),
      countRows("scheduled_broadcast", (query) =>
        query.eq("organization_id", orgId).eq("status", "queued"),
      ),
    ]);

  return { tags, assistants, automations, active, scheduledMessages };
}
