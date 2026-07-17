import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      insert: supabaseMocks.insert,
      select: supabaseMocks.select,
      single: supabaseMocks.single,
    }),
  }),
}));

import { createTrackedLink } from "@/lib/repos/trackedLinks.repo";

describe("Tracked-link repository defense in depth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.insert.mockReturnValue({
      select: supabaseMocks.select,
    });
    supabaseMocks.select.mockReturnValue({
      single: supabaseMocks.single,
    });
    supabaseMocks.single.mockResolvedValue({ data: { id: 1 }, error: null });
  });

  it("rejects invalid direct inserts before Supabase is called", async () => {
    await expect(
      createTrackedLink({
        destination_url: "file:///tmp/test",
      }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_TRACKED_LINK_URL" });

    expect(supabaseMocks.insert).not.toHaveBeenCalled();
  });

  it("allows legitimate HTTP and HTTPS inserts", async () => {
    await createTrackedLink({ destination_url: "http://example.com" });
    await createTrackedLink({ destination_url: "https://example.com/path" });

    expect(supabaseMocks.insert).toHaveBeenNthCalledWith(1, {
      destination_url: "http://example.com/",
    });
    expect(supabaseMocks.insert).toHaveBeenNthCalledWith(2, {
      destination_url: "https://example.com/path",
    });
  });
});
