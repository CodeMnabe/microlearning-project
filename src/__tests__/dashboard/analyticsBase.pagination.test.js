import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/db/admin", () => ({
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

import { fetchAllRows } from "@/lib/repos/analytics/analyticsBase.repo";

describe("fetchAllRows", () => {
  beforeEach(() => vi.clearAllMocks());

  it("paginates beyond the configured PostgREST row limit", async () => {
    const ranges = [];
    const pages = [
      [{ id: 1 }, { id: 2 }],
      [{ id: 3 }],
    ];

    const admin = {
      from: vi.fn(() => {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          range: vi.fn((from, to) => {
            ranges.push([from, to]);
            return Promise.resolve({ data: pages.shift(), error: null });
          }),
        };
        return query;
      }),
    };
    mocks.getSupabaseAdminClient.mockReturnValue(admin);

    await expect(
      fetchAllRows("message", "id", (query) => query.eq("role", "user"), 2),
    ).resolves.toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(ranges).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });
});
