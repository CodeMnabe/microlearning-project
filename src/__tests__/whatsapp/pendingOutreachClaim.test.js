import { beforeEach, describe, expect, it, vi } from "vitest";

const { builder } = vi.hoisted(() => ({
  builder: {
    from: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  },
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => builder) }));

import { claimPendingOutreach } from "@/lib/repos/pendingOutreach.repo";

beforeEach(() => vi.clearAllMocks());

describe("reclamar uma mensagem em espera", () => {
  it("reclama uma linha ainda sem resposta", async () => {
    builder.maybeSingle.mockResolvedValue({ data: { id: 9 }, error: null });
    expect(await claimPendingOutreach(9, "msg_1")).toBe(true);
    expect(builder.from).toHaveBeenCalledWith("pending_outreach");
    expect(builder.update).toHaveBeenCalledWith({ reply_message_id: "msg_1" });
    expect(builder.eq).toHaveBeenCalledWith("id", 9);
    expect(builder.eq).toHaveBeenCalledWith("status", "pending");
    expect(builder.is).toHaveBeenCalledWith("reply_message_id", null);
    expect(builder.select).toHaveBeenCalledWith("id");
  });

  it("não reclama uma linha que já foi reclamada", async () => {
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await claimPendingOutreach(9, "msg_2")).toBe(false);
  });
});
