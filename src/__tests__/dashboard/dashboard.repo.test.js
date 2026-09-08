import { beforeEach, describe, expect, it, vi } from "vitest";

const base = vi.hoisted(() => ({
  countRows: vi.fn(),
  fetchAllRows: vi.fn(),
}));

vi.mock("@/lib/repos/analytics/analyticsBase.repo", () => base);

import {
  getChannelUsageMetrics,
  getDashboardCountMetrics,
  getDashboardUserMetrics,
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
