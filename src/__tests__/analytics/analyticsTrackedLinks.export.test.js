// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rows: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/repos/analytics/analyticsBase.repo", () => ({ fetchExportRows: mocks.rows }));
import { getTrackedLinkReportsByOrg } from "@/lib/repos/trackedLinks.repo";

beforeEach(() => vi.resetAllMocks());

describe("tracked links in Excel exports", () => {
  it("filters the organization and period and reads events separately without embedded limits", async () => {
    const link = { id: 1, send_group_id: "send", recipient_user_id: 2, created_at: "2026-09-01" };
    const eq = vi.fn().mockReturnThis();
    const gte = vi.fn().mockReturnThis();
    const inFilter = vi.fn().mockReturnThis();
    mocks.rows.mockImplementation(async (table, columns, filters) => {
      filters({ eq, gte, in: inFilter });
      if (table === "tracked_link") {
        expect(columns).not.toContain("tracked_link_event");
        return [link];
      }
      return Array.from({ length: 1200 }, (_, id) => ({ id, tracked_link_id: 1 }));
    });
    const reports = await getTrackedLinkReportsByOrg(7, "2026-09-01", { paginate: true });
    expect(eq).toHaveBeenCalledWith("org_id", 7);
    expect(gte).toHaveBeenCalledWith("created_at", "2026-09-01");
    expect(inFilter).toHaveBeenCalledWith("tracked_link_id", [1]);
    expect(reports[0]).toMatchObject({ totalClicks: 1200, recipientCount: 1, clickedCount: 1, clickRate: 100 });
  });
  it("batches event filters and combines recipients in the same send", async () => {
    const links = Array.from({ length: 201 }, (_, id) => ({ id, send_group_id: "send", recipient_user_id: id }));
    mocks.rows.mockImplementation(async (table, _columns, filters) => {
      if (table === "tracked_link") return links;
      const query = { in: vi.fn().mockReturnThis() };
      filters(query);
      const ids = query.in.mock.calls[0][1];
      expect(ids.length).toBeLessThanOrEqual(200);
      return ids.map(id => ({ id, tracked_link_id: id }));
    });
    const reports = await getTrackedLinkReportsByOrg(7, null, { paginate: true });
    expect(mocks.rows).toHaveBeenCalledTimes(3);
    expect(reports[0]).toMatchObject({ totalClicks: 201, recipientCount: 201, clickedCount: 201 });
  });
  it("skips event queries for an empty organization", async () => {
    mocks.rows.mockResolvedValue([]);
    expect(await getTrackedLinkReportsByOrg(7, null, { paginate: true })).toEqual([]);
    expect(mocks.rows).toHaveBeenCalledTimes(1);
  });
});
