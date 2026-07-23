import { describe, it, expect, vi } from "vitest";
import { proxy } from "@/proxy";
import { NextResponse } from "next/server";

// Mock dependencies
vi.mock("next-intl/middleware", () => {
  return {
    default: vi.fn(() => {
      return vi.fn(() => {
        const res = new Response();
        return res;
      });
    }),
  };
});

let lastRequestPassedToSession;

vi.mock("@/utils/supabase/middleware", () => {
  return {
    updateSession: vi.fn((request) => {
      lastRequestPassedToSession = request;
      const res = new Response();
      res.cookies = {
        getAll: () => [],
        set: () => {},
      };
      return Promise.resolve({ response: res, user: null });
    }),
  };
});

describe("Proxy Middleware Security Controls", () => {
  it("applies CSP and security headers to API routes", async () => {
    const req = new Request("http://localhost/api/test");
    req.nextUrl = new URL(req.url);

    const res = await proxy(req);

    expect(res.headers.has("Content-Security-Policy")).toBe(true);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("applies no-store to sensitive HTML routes", async () => {
    const req = new Request("http://localhost/en/login");
    req.nextUrl = new URL(req.url);

    const res = await proxy(req);

    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("request interno contém x-nonce e CSP, e response não expõe x-nonce", async () => {
    const req = new Request("http://localhost/en/test");
    req.nextUrl = new URL(req.url);

    const res = await proxy(req);

    expect(lastRequestPassedToSession.headers.has("x-nonce")).toBe(true);
    expect(lastRequestPassedToSession.headers.has("Content-Security-Policy")).toBe(true);

    const cspInRequest = lastRequestPassedToSession.headers.get("Content-Security-Policy");
    expect(res.headers.get("Content-Security-Policy")).toBe(cspInRequest);
    expect(res.headers.has("x-nonce")).toBe(false);
  });

  it("redirects preservam a CSP e não expõem x-nonce", async () => {
    // Unauthenticated request to private route triggers redirect
    const req = new Request("http://localhost/en/admin");
    req.nextUrl = new URL(req.url);

    const res = await proxy(req);

    expect(res.status).toBe(307); // NextResponse.redirect
    expect(res.headers.has("Content-Security-Policy")).toBe(true);
    expect(res.headers.has("x-nonce")).toBe(false);
  });
});
