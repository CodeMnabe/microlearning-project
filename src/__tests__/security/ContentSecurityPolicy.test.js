import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildContentSecurityPolicy,
  generateNonce,
  getSupabaseOrigin,
} from "@/lib/security/contentSecurityPolicy";

describe("Content Security Policy Configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      "https://ztxzlixcprexbhdmqpkj.supabase.co";
  });

  it("includes expected default directives", () => {
    const csp = buildContentSecurityPolicy("test-nonce", true);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
  });

  it("produção sem unsafe-eval e inclui upgrade-insecure-requests", () => {
    const csp = buildContentSecurityPolicy("test-nonce", true);
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("produção sem unsafe-inline em script-src", () => {
    const csp = buildContentSecurityPolicy("test-nonce", true);
    const scriptSrcMatch = csp.match(/script-src([^;]+)/);
    expect(scriptSrcMatch).toBeTruthy();
    expect(scriptSrcMatch[1]).not.toContain("'unsafe-inline'");
  });

  it("desenvolvimento permite apenas o relaxamento mínimo necessário (unsafe-eval)", () => {
    const csp = buildContentSecurityPolicy("test-nonce", false);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("ausência de wildcard não justificada", () => {
    const csp = buildContentSecurityPolicy("test-nonce", true);
    expect(csp).not.toContain("*");
  });

  it("ausência de localhost em produção", () => {
    const csp = buildContentSecurityPolicy("test-nonce", true);
    expect(csp).not.toContain("localhost");
  });

  it("ausência de HTTP em produção (apenas HTTPS/WSS onde aplicável)", () => {
    const csp = buildContentSecurityPolicy("test-nonce", true);
    expect(csp).not.toMatch(/http:\/\//);
    expect(csp).not.toMatch(/ws:\/\//);
  });

  it("nonces diferentes por request", () => {
    const nonce1 = generateNonce();
    const nonce2 = generateNonce();
    expect(nonce1).not.toBe(nonce2);
    expect(nonce1.length).toBeGreaterThanOrEqual(22); // 16 bytes base64 is 24 chars
  });
});

describe("getSupabaseOrigin validation", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    vi.resetModules();
  });

  it("valida URL correta", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(getSupabaseOrigin(true)).toBe("https://example.supabase.co");
  });

  it("URL com path reduzida à origin", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      "https://example.supabase.co/path/to/thing?query=1#hash";
    expect(getSupabaseOrigin(true)).toBe("https://example.supabase.co");
  });

  it("URL com credentials rejeitada", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      "https://user:pass@example.supabase.co";
    expect(() => getSupabaseOrigin(true)).toThrow("cannot contain credentials");
  });

  it("URL HTTP rejeitada em produção", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://example.supabase.co";
    expect(() => getSupabaseOrigin(true)).toThrow(
      "must use HTTPS in production",
    );
  });

  it("valor inválido rejeitado", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";
    expect(() => getSupabaseOrigin(true)).toThrow("Invalid");
  });
});
