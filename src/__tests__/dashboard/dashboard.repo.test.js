import { beforeEach, describe, expect, it, vi } from "vitest";

const base = vi.hoisted(() => ({
  countRows: vi.fn(),
  fetchAllRows: vi.fn(),
  fetchRows: vi.fn(),
}));

vi.mock("@/lib/repos/analytics/analyticsBase.repo", () => base);

import {
  getChannelUsageMetrics,
  getDailyMessageActivity,
  getDashboardCountMetrics,
  getDashboardUserMetrics,
  getUpcomingScheduledBroadcasts,
  isWhatsAppConfigured,
} from "@/lib/repos/dashboard/dashboard.repo";

function queryRecorder() {
  const calls = [];
  const query = {
    eq: vi.fn((...args) => {
      calls.push(["eq", ...args]);
      return query;
    }),
    not: vi.fn((...args) => {
      calls.push(["not", ...args]);
      return query;
    }),
    in: vi.fn((...args) => {
      calls.push(["in", ...args]);
      return query;
    }),
    gte: vi.fn((...args) => {
      calls.push(["gte", ...args]);
      return query;
    }),
    order: vi.fn((...args) => {
      calls.push(["order", ...args]);
      return query;
    }),
    limit: vi.fn((...args) => {
      calls.push(["limit", ...args]);
      return query;
    }),
  };
  return { query, calls };
}

describe("dashboard repository metrics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns zero user metrics for an empty organization", async () => {
    base.fetchAllRows.mockResolvedValue([]);
    await expect(getDashboardUserMetrics(7)).resolves.toEqual({
      total: 0,
      teamsConfigured: 0,
      whatsappConfigured: 0,
    });
  });

  it("counts Teams only from a real teams_aad_object_id", async () => {
    base.fetchAllRows.mockResolvedValue([
      { id: 1, teams_aad_object_id: null, teams_from_id: "from-1" },
      { id: 2, teams_aad_object_id: "", teams_from_id: "from-2" },
      { id: 3, teams_aad_object_id: "   " },
      { id: 4, teams_aad_object_id: "aad-4" },
    ]);

    const metrics = await getDashboardUserMetrics(7);
    expect(metrics.total).toBe(4);
    expect(metrics.teamsConfigured).toBe(1);
  });

  it.each([
    [{ phone_number: "+351900000000" }, true],
    [{ phone_country_code: "+351", phone_national: "900000000" }, true],
    [{ whatsapp_bsuid: "WA.1" }, true],
    [{ bird_contact_id: "bird-1" }, true],
    [{ phone_country_code: "+351", phone_national: "  " }, false],
    [{ phone_country_code: "  ", phone_national: "900000000" }, false],
    [{ phone_number: "   " }, false],
  ])("applies the operational WhatsApp definition", (user, expected) => {
    expect(isWhatsAppConfigured(user)).toBe(expected);
  });

  it("counts distinct users per channel after organization/user-role filters", async () => {
    const recorder = queryRecorder();
    base.fetchAllRows.mockImplementation((_table, _columns, applyFilters) => {
      applyFilters(recorder.query);
      return [
        { user_id: 1, channel: "teams" },
        { user_id: 1, channel: "teams" },
        { user_id: 2, channel: "whatsapp" },
        { user_id: 2, channel: "whatsapp" },
        { user_id: null, channel: "teams" },
      ];
    });

    await expect(getChannelUsageMetrics(7)).resolves.toEqual({
      teamsUsed: 1,
      whatsappUsed: 1,
    });
    expect(recorder.calls).toContainEqual(["eq", "organization_id", 7]);
    expect(recorder.calls).toContainEqual(["eq", "role", "user"]);
    expect(recorder.calls).toContainEqual(["not", "user_id", "is", null]);
    expect(recorder.calls).toContainEqual([
      "in",
      "channel",
      ["teams", "whatsapp"],
    ]);
  });

  it("uses org_id for tags and counts every queued broadcast", async () => {
    const filters = [];
    base.countRows.mockImplementation((table, applyFilters) => {
      const recorder = queryRecorder();
      applyFilters(recorder.query);
      filters.push({ table, calls: recorder.calls });
      return Promise.resolve(table === "automation_rule" ? 2 : 1);
    });

    await expect(getDashboardCountMetrics(7)).resolves.toEqual({
      tags: 1,
      assistants: 1,
      automations: 2,
      active: 2,
      scheduledMessages: 1,
    });

    expect(filters.find(({ table }) => table === "tags").calls).toContainEqual([
      "eq",
      "org_id",
      7,
    ]);
    const scheduled = filters.find(
      ({ table }) => table === "scheduled_broadcast",
    );
    expect(scheduled.calls).toContainEqual(["eq", "organization_id", 7]);
    expect(scheduled.calls).toContainEqual(["eq", "status", "queued"]);
    expect(scheduled.calls.flat()).not.toContain("source");
    expect(scheduled.calls.flat()).not.toContain("scheduled_for");
  });
});

describe("dashboard activity and upcoming sends", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds a continuous daily series with zeros and buckets by channel", async () => {
    const today = new Date().toISOString().slice(0, 10);
    base.fetchAllRows.mockImplementation(async (table, columns, applyFilters) => {
      const { query, calls } = queryRecorder();
      applyFilters(query);
      expect(table).toBe("message");
      expect(calls).toEqual(
        expect.arrayContaining([
          ["eq", "organization_id", 7],
          ["in", "channel", ["teams", "whatsapp"]],
        ]),
      );
      expect(calls.find((call) => call[0] === "gte")?.[1]).toBe("created_at");
      return [
        { created_at: `${today}T09:00:00Z`, channel: "teams" },
        { created_at: `${today}T10:00:00Z`, channel: "whatsapp" },
        { created_at: `${today}T11:00:00Z`, channel: "whatsapp" },
        { created_at: "2000-01-01T00:00:00Z", channel: "teams" },
        { created_at: `${today}T12:00:00Z`, channel: "email" },
      ];
    });

    const series = await getDailyMessageActivity(7, 3);
    expect(series).toHaveLength(3);
    expect(series.at(-1)).toEqual({ date: today, teams: 1, whatsapp: 2 });
    expect(series[0]).toEqual({ date: series[0].date, teams: 0, whatsapp: 0 });
  });

  it("lists queued broadcasts in send order with a trimmed preview", async () => {
    base.fetchRows.mockImplementation(async (table, columns, applyFilters) => {
      const { query, calls } = queryRecorder();
      applyFilters(query);
      expect(table).toBe("scheduled_broadcast");
      expect(calls).toEqual([
        ["eq", "organization_id", 7],
        ["eq", "status", "queued"],
        ["order", "scheduled_for", { ascending: true }],
        ["limit", 5],
      ]);
      return [
        {
          id: "a",
          channel: "WhatsApp",
          scheduled_for: "2026-09-09T08:00:00Z",
          recipient_count: "12",
          payload: { text: "  Bom dia equipa  " },
        },
        {
          id: "b",
          channel: "teams",
          scheduled_for: null,
          recipient_count: null,
          payload: "x".repeat(200),
        },
      ];
    });

    const items = await getUpcomingScheduledBroadcasts(7);
    expect(items).toEqual([
      {
        id: "a",
        channel: "whatsapp",
        scheduledFor: "2026-09-09T08:00:00Z",
        recipients: 12,
        preview: "Bom dia equipa",
      },
      {
        id: "b",
        channel: "teams",
        scheduledFor: null,
        recipients: 0,
        preview: "x".repeat(120),
      },
    ]);
  });
});
