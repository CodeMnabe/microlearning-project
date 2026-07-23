import { beforeEach, describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  getTrackedLinkByToken: vi.fn(),
  getTrackedLinkById: vi.fn(),
  recordTrackedLinkInteraction: vi.fn(),
}));
const capacityMocks = vi.hoisted(() => ({ consumeCapacitySet: vi.fn() }));

vi.mock("@/lib/repos/trackedLinks.repo", () => repoMocks);
vi.mock("@/lib/repos/requestCapacity.repo", () => capacityMocks);

import { GET, HEAD, POST } from "@/app/api/tracked-links/[token]/route.js";

const TOKEN = "abcdefghijklmnopqrstuvwx";
const ACTIVE_LINK = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  org_id: 7,
  recipient_user_id: 42,
  destination_url: "https://example.com/path?q=1#top",
  link_label: "Example",
  expires_at: "2099-01-01T00:00:00.000Z",
  revoked_at: null,
};

function request(method = "GET", body = undefined, userAgent = "Mozilla/5.0") {
  return new Request(`https://app.example/api/tracked-links/${TOKEN}`, {
    method,
    headers: {
      "user-agent": userAgent,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Public tracked-link interaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ABUSE_IDENTITY_SECRET = "test-secret-with-at-least-thirty-two-bytes";
    capacityMocks.consumeCapacitySet.mockResolvedValue({ accepted: true });
    repoMocks.getTrackedLinkByToken.mockResolvedValue(ACTIVE_LINK);
    repoMocks.getTrackedLinkById.mockResolvedValue(ACTIVE_LINK);
    repoMocks.recordTrackedLinkInteraction.mockResolvedValue({ outcome: "recorded" });
  });

  it("does not write for an invalid token", async () => {
    const response = await GET(request(), { params: Promise.resolve({ token: "bad" }) });
    expect(response.status).toBe(404);
    expect(repoMocks.getTrackedLinkByToken).not.toHaveBeenCalled();
    expect(repoMocks.recordTrackedLinkInteraction).not.toHaveBeenCalled();
  });

  it("resolves an active link without recording a click", async () => {
    const response = await GET(request(), { params: Promise.resolve({ token: TOKEN }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.destinationUrl).toBe(ACTIVE_LINK.destination_url);
    expect(body.interactionContext).toEqual(expect.any(String));
    expect(repoMocks.recordTrackedLinkInteraction).not.toHaveBeenCalled();
  });

  it.each([
    ["expired", { expires_at: "2020-01-01T00:00:00.000Z" }],
    ["revoked", { revoked_at: "2026-01-01T00:00:00.000Z" }],
    ["missing expiry", { expires_at: null }],
  ])("fails closed for an %s link", async (_label, patch) => {
    repoMocks.getTrackedLinkByToken.mockResolvedValue({ ...ACTIVE_LINK, ...patch });
    const response = await GET(request(), { params: Promise.resolve({ token: TOKEN }) });
    expect(response.status).toBe(404);
    expect(repoMocks.recordTrackedLinkInteraction).not.toHaveBeenCalled();
  });

  it("HEAD validates without consuming capacity or writing", async () => {
    const response = await HEAD(request("HEAD"), { params: Promise.resolve({ token: TOKEN }) });
    expect(response.status).toBe(200);
    expect(capacityMocks.consumeCapacitySet).not.toHaveBeenCalled();
    expect(repoMocks.recordTrackedLinkInteraction).not.toHaveBeenCalled();
  });

  it.each([
    ["preview", "Slackbot-LinkExpanding 1.0"],
    ["scanner", "urlscan.io scanner"],
    ["unknown", "custom-client"],
  ])("does not issue interaction context to a %s client", async (_label, userAgent) => {
    const response = await GET(request("GET", undefined, userAgent), {
      params: Promise.resolve({ token: TOKEN }),
    });
    expect((await response.json()).interactionContext).toBeNull();
  });

  it("rejects POST without a valid context", async () => {
    const response = await POST(request("POST", { interactionContext: "invalid" }), {
      params: Promise.resolve({ token: TOKEN }),
    });
    expect(response.status).toBe(404);
    expect(repoMocks.recordTrackedLinkInteraction).not.toHaveBeenCalled();
  });

  it("records a valid browser interaction with the stored recipient", async () => {
    const resolution = await GET(request(), { params: Promise.resolve({ token: TOKEN }) });
    const { interactionContext } = await resolution.json();
    const response = await POST(request("POST", { interactionContext }), {
      params: Promise.resolve({ token: TOKEN }),
    });
    expect(response.status).toBe(202);
    expect(repoMocks.recordTrackedLinkInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        trackedLinkId: ACTIVE_LINK.id,
        recipientUserId: ACTIVE_LINK.recipient_user_id,
        clientClassification: "browser",
      }),
    );
  });

  it("rejects recipient binding changes", async () => {
    const resolution = await GET(request(), { params: Promise.resolve({ token: TOKEN }) });
    const { interactionContext } = await resolution.json();
    repoMocks.getTrackedLinkById.mockResolvedValue({ ...ACTIVE_LINK, recipient_user_id: 99 });
    const response = await POST(request("POST", { interactionContext }), {
      params: Promise.resolve({ token: TOKEN }),
    });
    expect(response.status).toBe(404);
    expect(repoMocks.recordTrackedLinkInteraction).not.toHaveBeenCalled();
  });

  it("limits token probing before database lookup", async () => {
    capacityMocks.consumeCapacitySet.mockResolvedValue({ accepted: false, retryAfterSeconds: 30 });
    const response = await GET(request(), { params: Promise.resolve({ token: TOKEN }) });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(repoMocks.getTrackedLinkByToken).not.toHaveBeenCalled();
  });

  it("evaluates the global probing limit before token and visitor limits", async () => {
    capacityMocks.consumeCapacitySet.mockResolvedValue({ accepted: true });
    await GET(request(), { params: Promise.resolve({ token: TOKEN }) });
    const entries = capacityMocks.consumeCapacitySet.mock.calls[0][0];
    expect(entries[0].scope).toBe("tracked-link-probing-global");
    expect(entries[1].scope).toBe("tracked-link-token");
    expect(entries[2].scope).toBe("tracked-link-visitor");
  });

  it("keeps an already resolved destination usable when analytics is limited", async () => {
    const resolution = await GET(request(), { params: Promise.resolve({ token: TOKEN }) });
    const { interactionContext, destinationUrl } = await resolution.json();
    repoMocks.recordTrackedLinkInteraction.mockResolvedValue({ outcome: "rate_limited" });
    const response = await POST(request("POST", { interactionContext }), {
      params: Promise.resolve({ token: TOKEN }),
    });
    expect(destinationUrl).toBe(ACTIVE_LINK.destination_url);
    expect(response.status).toBe(202);
  });

  it("keeps a replay deduplicated by the durable interaction contract", async () => {
    const resolution = await GET(request(), { params: Promise.resolve({ token: TOKEN }) });
    const { interactionContext } = await resolution.json();
    repoMocks.recordTrackedLinkInteraction.mockResolvedValue({ outcome: "duplicate" });
    const response = await POST(request("POST", { interactionContext }), {
      params: Promise.resolve({ token: TOKEN }),
    });
    expect(response.status).toBe(202);
    expect(repoMocks.recordTrackedLinkInteraction).toHaveBeenCalledTimes(1);
  });

  it("does not expose an unsafe legacy destination", async () => {
    repoMocks.getTrackedLinkByToken.mockResolvedValue({
      ...ACTIVE_LINK,
      destination_url: "javascript:alert(1)",
    });
    const response = await GET(request(), { params: Promise.resolve({ token: TOKEN }) });
    expect(response.status).toBe(404);
    expect(JSON.stringify(await response.json())).not.toContain("javascript:");
  });

  it("does not log tokens, URLs, hashes or recipient data", async () => {
    const resolution = await GET(request(), { params: Promise.resolve({ token: TOKEN }) });
    const { interactionContext } = await resolution.json();
    const secretHash = "a".repeat(64);
    const sink = vi.spyOn(console, "error").mockImplementation(() => undefined);
    repoMocks.getTrackedLinkById.mockRejectedValue(
      new Error(`${TOKEN} ${ACTIVE_LINK.destination_url} ${secretHash} ${ACTIVE_LINK.recipient_user_id}`),
    );
    const response = await POST(request("POST", { interactionContext }), {
      params: Promise.resolve({ token: TOKEN }),
    });
    expect(response.status).toBe(202);
    const serialized = JSON.stringify(sink.mock.calls);
    expect(serialized).not.toContain(TOKEN);
    expect(serialized).not.toContain(ACTIVE_LINK.destination_url);
    expect(serialized).not.toContain(secretHash);
    expect(serialized).not.toContain(String(ACTIVE_LINK.recipient_user_id));
    sink.mockRestore();
  });
});
