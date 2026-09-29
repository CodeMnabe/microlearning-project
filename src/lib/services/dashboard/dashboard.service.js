import { safeNumberForApi } from "@/lib/helpers/analytics.helpers";
import {
  DASHBOARD_ACTIVITY_DAYS,
  getChannelUsageMetrics,
  getDailyMessageActivity,
  getDashboardCountMetrics,
  getDashboardUserMetrics,
  getUpcomingScheduledBroadcasts,
} from "@/lib/repos/dashboard/dashboard.repo";

export const EMPTY_DASHBOARD_OVERVIEW = Object.freeze({
  users: Object.freeze({
    total: 0,
    teamsConfigured: 0,
    whatsappConfigured: 0,
    teamsUsed: 0,
    whatsappUsed: 0,
  }),
  content: Object.freeze({
    tags: 0,
    assistants: 0,
  }),
  automations: Object.freeze({
    total: 0,
    active: 0,
    scheduledMessages: 0,
  }),
  activity: Object.freeze({
    days: DASHBOARD_ACTIVITY_DAYS,
    total: 0,
    series: Object.freeze([]),
  }),
  upcoming: Object.freeze([]),
});

export async function getDashboardOverview(orgId) {
  const [users, channelUsage, counts, series, upcoming] = await Promise.all([
    getDashboardUserMetrics(orgId),
    getChannelUsageMetrics(orgId),
    getDashboardCountMetrics(orgId),
    getDailyMessageActivity(orgId),
    getUpcomingScheduledBroadcasts(orgId),
  ]);

  const activitySeries = series.map((day) => ({
    date: day.date,
    teams: safeNumberForApi(day.teams),
    whatsapp: safeNumberForApi(day.whatsapp),
  }));

  return {
    users: {
      total: safeNumberForApi(users.total),
      teamsConfigured: safeNumberForApi(users.teamsConfigured),
      whatsappConfigured: safeNumberForApi(users.whatsappConfigured),
      teamsUsed: safeNumberForApi(channelUsage.teamsUsed),
      whatsappUsed: safeNumberForApi(channelUsage.whatsappUsed),
    },
    content: {
      tags: safeNumberForApi(counts.tags),
      assistants: safeNumberForApi(counts.assistants),
    },
    automations: {
      total: safeNumberForApi(counts.automations),
      active: safeNumberForApi(counts.active),
      scheduledMessages: safeNumberForApi(counts.scheduledMessages),
    },
    activity: {
      days: DASHBOARD_ACTIVITY_DAYS,
      total: activitySeries.reduce((sum, day) => sum + day.teams + day.whatsapp, 0),
      series: activitySeries,
    },
    upcoming,
  };
}
