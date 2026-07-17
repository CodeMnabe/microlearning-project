import { beforeEach, describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  createTrackedLink: vi.fn(),
}));

vi.mock("@/lib/repos/trackedLinks.repo", () => repoMocks);

import {
  createTrackedLinkForRecipient,
  resolveTrackedLinksForRecipient,
} from "@/lib/services/broadcast/trackedLinks";

describe("Tracked-link creation guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example";
    repoMocks.createTrackedLink.mockResolvedValue({ id: 1 });
  });

  it("does not call the repository for an invalid direct service input", async () => {
    await expect(
      createTrackedLinkForRecipient({
        orgId: 1,
        channel: "teams",
        destinationUrl:
          "javascript:document.body.dataset.securityTest='executed'",
        linkLabel: "Test",
      }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_TRACKED_LINK_URL" });

    expect(repoMocks.createTrackedLink).not.toHaveBeenCalled();
  });

  it("persists the canonical form for a legitimate HTTPS destination", async () => {
    const result = await createTrackedLinkForRecipient({
      orgId: 1,
      channel: "teams",
      destinationUrl: " HTTPS://EXAMPLE.COM/course?q=1#top ",
      linkLabel: "Course",
    });

    expect(repoMocks.createTrackedLink).toHaveBeenCalledWith(
      expect.objectContaining({
        destination_url: "https://example.com/course?q=1#top",
      }),
    );
    expect(result.row).toEqual({ id: 1 });
  });

  it("validates all recipient links before any insert", async () => {
    await expect(
      resolveTrackedLinksForRecipient({
        orgId: 1,
        channel: "whatsapp",
        trackedLinks: [
          { key: "ok", label: "OK", destinationUrl: "https://example.com" },
          {
            key: "bad",
            label: "Bad",
            destinationUrl: "data:text/html,unsafe-test-payload",
          },
        ],
      }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_TRACKED_LINK_URL" });

    expect(repoMocks.createTrackedLink).not.toHaveBeenCalled();
  });
});
