import { describe, it, expect } from "vitest";
import { getSecurityHeaders } from "@/lib/security/securityHeaders";

describe("Security Headers Configuration", () => {
  it("includes standard security headers", () => {
    const headers = getSecurityHeaders(true);
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-DNS-Prefetch-Control")).toBe("off");
    expect(headers.get("X-XSS-Protection")).toBe("0");
    expect(headers.has("Permissions-Policy")).toBe(true);
  });

  it("HSTS apenas em produção", () => {
    const prodHeaders = getSecurityHeaders(true);
    expect(prodHeaders.get("Strict-Transport-Security")).toContain("max-age=");

    const devHeaders = getSecurityHeaders(false);
    expect(devHeaders.has("Strict-Transport-Security")).toBe(false);
  });
});
