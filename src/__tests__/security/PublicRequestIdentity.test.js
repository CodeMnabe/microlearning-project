import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { deriveOpaqueIdentifier } from "@/lib/security/opaqueIdentity";
import { getTrustedClientIp } from "@/lib/security/clientIdentity";

const original = { ...process.env };

afterEach(() => {
  process.env.ABUSE_IDENTITY_SECRET = original.ABUSE_IDENTITY_SECRET;
  process.env.TRUSTED_PROXY_MODE = original.TRUSTED_PROXY_MODE;
  process.env.VERCEL = original.VERCEL;
});

describe("Opaque public request identity", () => {
  it("uses HMAC-SHA-256 with domain separation", () => {
    process.env.ABUSE_IDENTITY_SECRET = "test-secret-with-at-least-thirty-two-bytes";
    const ip = deriveOpaqueIdentifier("contact-ip", "192.0.2.10");
    const visitor = deriveOpaqueIdentifier("tracked-link-visitor", "192.0.2.10");
    expect(ip).toMatch(/^[0-9a-f]{64}$/);
    expect(ip).not.toBe(visitor);
    expect(ip).toBe(
      createHmac("sha256", process.env.ABUSE_IDENTITY_SECRET)
        .update("mydigitalbot:contact-ip\0")
        .update("192.0.2.10")
        .digest("hex"),
    );
  });

  it("fails closed without an explicit strong secret", () => {
    delete process.env.ABUSE_IDENTITY_SECRET;
    expect(() => deriveOpaqueIdentifier("contact-ip", "192.0.2.10")).toThrow();
    process.env.ABUSE_IDENTITY_SECRET = "short";
    expect(() => deriveOpaqueIdentifier("contact-ip", "192.0.2.10")).toThrow();
  });

  it("does not trust forwarded headers without an explicit deployment mode", () => {
    delete process.env.TRUSTED_PROXY_MODE;
    const req = new Request("https://example.test", { headers: { "x-forwarded-for": "192.0.2.10" } });
    expect(getTrustedClientIp(req)).toBeNull();
  });

  it("normalizes valid proxy addresses and rejects malformed values", () => {
    process.env.TRUSTED_PROXY_MODE = "single";
    expect(getTrustedClientIp(new Request("https://example.test", { headers: { "x-real-ip": "192.000.002.010" } }))).toBeNull();
    expect(getTrustedClientIp(new Request("https://example.test", { headers: { "x-real-ip": "192.0.2.10" } }))).toBe("192.0.2.10");
    expect(getTrustedClientIp(new Request("https://example.test", { headers: { "x-real-ip": "2001:DB8::1" } }))).toBe("2001:db8::1");
    expect(getTrustedClientIp(new Request("https://example.test", { headers: { "x-real-ip": "2001:0DB8:0000:0000:0000:0000:0000:0001" } }))).toBe("2001:db8::1");
  });
});
