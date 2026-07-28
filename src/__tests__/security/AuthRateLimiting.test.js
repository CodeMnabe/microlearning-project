import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/repos/requestCapacity.repo", () => ({
  consumeCapacitySet: vi.fn(),
}));
vi.mock("@/lib/security/clientIdentity", () => ({
  deriveClientIdentity: vi.fn(() => ({ subjectHash: "mock-ip-hash" })),
}));
vi.mock("@/lib/security/opaqueIdentity", () => ({
  deriveOpaqueIdentifier: vi.fn(
    (prefix, value) => `mock-hash-${prefix}-${value}`,
  ),
}));

import { checkAuthRateLimit } from "@/lib/auth/authRateLimit";
import { consumeCapacitySet } from "@/lib/repos/requestCapacity.repo";

describe("AuthRateLimiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checkAuthRateLimit calls consumeCapacitySet with correct login scopes", async () => {
    consumeCapacitySet.mockResolvedValue({ accepted: true });
    await checkAuthRateLimit({}, "login", "test@example.com");
    expect(consumeCapacitySet).toHaveBeenCalled();
    const calls = consumeCapacitySet.mock.calls[0][0];
    expect(calls.some((c) => c.scope.includes("login"))).toBe(true);
  });

  it("checkAuthRateLimit calls consumeCapacitySet with correct reset scopes", async () => {
    consumeCapacitySet.mockResolvedValue({ accepted: true });
    await checkAuthRateLimit({}, "reset", "test@example.com");
    const calls = consumeCapacitySet.mock.calls[0][0];
    expect(calls.some((c) => c.scope.includes("reset"))).toBe(true);
  });

  it("returns accepted:false with retryAfterSeconds when capacity exhausted", async () => {
    consumeCapacitySet.mockResolvedValue({
      accepted: false,
      retryAfterSeconds: 60,
    });
    const result = await checkAuthRateLimit({}, "login", "test@example.com");
    expect(result.accepted).toBe(false);
    expect(result.retryAfterSeconds).toBeDefined();
  });

  it("uses 3 entries (global, IP, account) when email provided", async () => {
    consumeCapacitySet.mockResolvedValue({ accepted: true });
    await checkAuthRateLimit({}, "login", "test@example.com");
    const calls = consumeCapacitySet.mock.calls[0][0];
    expect(calls.length).toBe(3);
  });

  it("short-circuits: does not create account bucket when not needed", async () => {
    consumeCapacitySet.mockResolvedValue({ accepted: true });
    await checkAuthRateLimit({}, "login", null);
    const calls = consumeCapacitySet.mock.calls[0][0];
    expect(calls.some((c) => c.scope.includes("account"))).toBe(false);
    expect(calls.length).toBe(2);
  });

  it("login and reset use distinct scope prefixes", async () => {
    consumeCapacitySet.mockResolvedValue({ accepted: true });
    await checkAuthRateLimit({}, "login", "test@example.com");
    await checkAuthRateLimit({}, "reset", "test@example.com");

    const loginCalls = consumeCapacitySet.mock.calls[0][0];
    const resetCalls = consumeCapacitySet.mock.calls[1][0];

    expect(loginCalls[0].scope).not.toEqual(resetCalls[0].scope);
  });
});
