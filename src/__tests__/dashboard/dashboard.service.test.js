import { describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  getDashboardUserMetrics: vi.fn().mockResolvedValue({
    total: 0,
    teamsConfigured: 0,
    whatsappConfigured: 0,
  }),
  getChannelUsageMetrics: vi.fn().mockResolvedValue({
    teamsUsed: 0,
    whatsappUsed: 0,
  }),
  getDashboardCountMetrics: vi.fn().mockResolvedValue({
    tags: 0,
    assistants: 0,
    automations: 0,
    active: 0,
    scheduledMessages: 0,
  }),
  getDailyMessageActivity: vi.fn().mockResolvedValue([
    { date: "2026-09-07", teams: 0, whatsapp: 0 },
    { date: "2026-09-08", teams: 2, whatsapp: 3 },
  ]),
  getUpcomingScheduledBroadcasts: vi.fn().mockResolvedValue([]),
  DASHBOARD_ACTIVITY_DAYS: 14,
}));

vi.mock("@/lib/repos/dashboard/dashboard.repo", () => repo);

import { getDashboardOverview } from "@/lib/services/dashboard/dashboard.service";

describe("dashboard service", () => {
  it("returns all metrics as numeric zero when the organization is empty", async () => {
    const overview = await getDashboardOverview(7);
    expect(overview).toEqual({
      users: {
        total: 0,
        teamsConfigured: 0,
        whatsappConfigured: 0,
        teamsUsed: 0,
        whatsappUsed: 0,
      },
      content: { tags: 0, assistants: 0 },
      automations: { total: 0, active: 0, scheduledMessages: 0 },
      activity: {
        days: 14,
        total: 5,
        series: [
          { date: "2026-09-07", teams: 0, whatsapp: 0 },
          { date: "2026-09-08", teams: 2, whatsapp: 3 },
        ],
      },
      upcoming: [],
    });
    expect(repo.getDashboardUserMetrics).toHaveBeenCalledWith(7);
    expect(repo.getChannelUsageMetrics).toHaveBeenCalledWith(7);
    expect(repo.getDashboardCountMetrics).toHaveBeenCalledWith(7);
    expect(repo.getDailyMessageActivity).toHaveBeenCalledWith(7);
    expect(repo.getUpcomingScheduledBroadcasts).toHaveBeenCalledWith(7);
  });
});
