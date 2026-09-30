import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchRows: vi.fn() }));

vi.mock("@/lib/repos/analytics/analyticsBase.repo", () => ({
  fetchRows: mocks.fetchRows,
}));

import { getUserMetrics } from "@/lib/repos/analytics/analyticsUsers.repo";

describe("Analytics WhatsApp configuration metric", () => {
  it("includes a country-code plus national-number recipient", async () => {
    mocks.fetchRows.mockResolvedValue([
      {
        id: 1,
        phone_number: null,
        phone_country_code: "+351",
        phone_national: "900000000",
        whatsapp_bsuid: null,
        bird_contact_id: null,
      },
    ]);

    const metrics = await getUserMetrics(7);
    expect(metrics.withWhatsapp).toBe(1);
  });
});
