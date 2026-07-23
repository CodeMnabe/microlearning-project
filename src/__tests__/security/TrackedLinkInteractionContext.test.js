import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTrackedLinkContext,
  verifyTrackedLinkContext,
} from "@/lib/services/broadcast/trackedLinkInteraction";
import { TRACKED_LINK_CONTEXT_TTL_SECONDS } from "@/lib/limits/publicAbuse";

const payload = Object.freeze({
  trackedLinkId: "123e4567-e89b-42d3-a456-426614174000",
  visitorHash: "a".repeat(64),
  tokenHash: "b".repeat(64),
  recipientUserId: 42,
  clientClassification: "browser",
});

function alterContext(context, index, value) {
  const bytes = Buffer.from(context, "base64url");
  bytes[index] = value;
  return bytes.toString("base64url");
}

describe("Tracked-link interaction context", () => {
  const originalSecret = process.env.ABUSE_IDENTITY_SECRET;

  beforeEach(() => {
    process.env.ABUSE_IDENTITY_SECRET = "test-secret-with-at-least-thirty-two-bytes";
  });

  afterEach(() => {
    process.env.ABUSE_IDENTITY_SECRET = originalSecret;
  });

  it("uses a fresh 96-bit nonce and validates a protected context", () => {
    const first = createTrackedLinkContext({ ...payload, now: 1_000 });
    const second = createTrackedLinkContext({ ...payload, now: 1_000 });
    expect(first).not.toBe(second);
    expect(Buffer.from(first, "base64url").subarray(2, 14)).toHaveLength(12);
    expect(verifyTrackedLinkContext(first, { now: 1_001 })).toMatchObject({
      trackedLinkId: payload.trackedLinkId,
      recipientUserId: 42,
      clientClassification: "browser",
    });
  });

  it.each([
    ["ciphertext", 30],
    ["authentication tag", 14],
    ["nonce", 2],
  ])("rejects an altered %s before reading payload", (_label, index) => {
    const context = createTrackedLinkContext({ ...payload, now: 1_000 });
    expect(verifyTrackedLinkContext(alterContext(context, index, 0xff), { now: 1_001 })).toBeNull();
  });

  it("rejects expired, wrong-purpose and unknown-version contexts", () => {
    const context = createTrackedLinkContext({ ...payload, now: 1_000 });
    expect(
      verifyTrackedLinkContext(context, {
        now: 1_000 + (TRACKED_LINK_CONTEXT_TTL_SECONDS + 1) * 1_000,
      }),
    ).toBeNull();
    expect(verifyTrackedLinkContext(alterContext(context, 1, 2), { now: 1_001 })).toBeNull();
    expect(verifyTrackedLinkContext(alterContext(context, 0, 2), { now: 1_001 })).toBeNull();
  });

  it("rejects oversized input and a context sealed with another key", () => {
    const context = createTrackedLinkContext({ ...payload, now: 1_000 });
    expect(verifyTrackedLinkContext("a".repeat(1025), { now: 1_001 })).toBeNull();
    process.env.ABUSE_IDENTITY_SECRET = "a-different-test-secret-with-at-least-32-bytes";
    expect(verifyTrackedLinkContext(context, { now: 1_001 })).toBeNull();
  });
});
