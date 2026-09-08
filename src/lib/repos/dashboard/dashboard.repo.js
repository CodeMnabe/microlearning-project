import {
  getDayKey,
  getDayRange,
  hasValue,
} from "@/lib/helpers/analytics.helpers";
import {
  countRows,
  fetchAllRows,
  fetchRows,
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

export const DASHBOARD_ACTIVITY_DAYS = 14;
export const DASHBOARD_UPCOMING_LIMIT = 5;

function startOfDaysAgo(days) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

/**
 * Mensagens por dia e por canal nos últimos `days` dias (inclui hoje).
 * Devolve uma série contínua, com zeros nos dias sem mensagens.
 */
export async function getDailyMessageActivity(
  orgId,
  days = DASHBOARD_ACTIVITY_DAYS,
) {
  const start = startOfDaysAgo(days);

  const rows = await fetchAllRows(
    "message",
    "created_at, channel",
    (query) =>
      query
        .eq("organization_id", orgId)
        .gte("created_at", start.toISOString())
        .in("channel", ["teams", "whatsapp"]),
  );

  const byDay = Object.fromEntries(
    getDayRange(start).map((day) => [day, { date: day, teams: 0, whatsapp: 0 }]),
  );

  for (const row of rows) {
    const day = getDayKey(row?.created_at);
    if (!day || !(day in byDay)) continue;
    if (row.channel === "teams") byDay[day].teams += 1;
    if (row.channel === "whatsapp") byDay[day].whatsapp += 1;
  }

  return Object.values(byDay);
}

function getPayloadMessage(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;

  return String(
    payload.message ??
      payload.text ??
      payload.body ??
      payload.content ??
      payload.caption ??
      "",
  );
}

/**
 * Próximos envios agendados que ainda estão em fila, por ordem de envio.
 */
export async function getUpcomingScheduledBroadcasts(
  orgId,
  limit = DASHBOARD_UPCOMING_LIMIT,
) {
  const rows = await fetchRows(
    "scheduled_broadcast",
    "id, channel, scheduled_for, recipient_count, payload",
    (query) =>
      query
        .eq("organization_id", orgId)
        .eq("status", "queued")
        .order("scheduled_for", { ascending: true })
        .limit(limit),
  );

  return rows.map((row) => ({
    id: row.id,
    channel: String(row.channel || "").toLowerCase(),
    scheduledFor: row.scheduled_for ?? null,
    recipients: Number(row.recipient_count) || 0,
    preview: getPayloadMessage(row.payload).trim().slice(0, 120),
  }));
}
