import { beforeEach, describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  getTrackedLinkByToken: vi.fn(),
  createTrackedLinkEvent: vi.fn(),
}));

vi.mock("@/lib/repos/trackedLinks.repo", () => repoMocks);

import { GET } from "@/app/api/tracked-links/[token]/route.js";

describe("SEC-01 public tracked-link resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMocks.createTrackedLinkEvent.mockResolvedValue({ id: 1 });
  });

  it("returns HTTP 400 without exposing an old unsafe destination", async () => {
    repoMocks.getTrackedLinkByToken.mockResolvedValue({
      id: 1,
      destination_url:
        "javascript:document.body.dataset.securityTest='executed'",
      link_label: "Old link",
    });

    const response = await GET(
      new Request("https://app.example/api/tracked-links/token"),
      { params: Promise.resolve({ token: "token" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Tracked link destination is invalid" });
    expect(JSON.stringify(body)).not.toContain("javascript:");
    expect(repoMocks.createTrackedLinkEvent).not.toHaveBeenCalled();
  });

  it("returns canonical HTTP and HTTPS destinations", async () => {
    repoMocks.getTrackedLinkByToken
      .mockResolvedValueOnce({
        id: 1,
        destination_url: " HTTP://EXAMPLE.COM ",
        link_label: "HTTP",
      })
      .mockResolvedValueOnce({
        id: 2,
        destination_url: "https://example.com/path?q=1#top",
        link_label: "HTTPS",
      });

    const request = new Request("https://app.example/api/tracked-links/token");
    const httpResponse = await GET(request, {
      params: Promise.resolve({ token: "token-1" }),
    });
    const httpsResponse = await GET(request, {
      params: Promise.resolve({ token: "token-2" }),
    });

    expect(httpResponse.status).toBe(200);
    expect((await httpResponse.json()).destinationUrl).toBe(
      "http://example.com/",
    );
    expect(httpsResponse.status).toBe(200);
    expect((await httpsResponse.json()).destinationUrl).toBe(
      "https://example.com/path?q=1#top",
    );
  });
});
