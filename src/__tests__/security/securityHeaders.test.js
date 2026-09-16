import { describe, expect, it } from "vitest";
import { buildSecurityHeaders } from "@/lib/security/headers";

describe("cabeçalhos de segurança", () => {
  it("restringe a CSP e ativa HSTS em produção", () => {
    const headers = buildSecurityHeaders({
      supabaseUrl: "https://exemplo.supabase.co",
      isProduction: true,
      isVercelPreview: false,
    });
    const csp = headers.find(({ key }) => key === "Content-Security-Policy").value;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("connect-src 'self' https://exemplo.supabase.co");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(headers.some(({ key }) => key === "Strict-Transport-Security")).toBe(true);
  });

  it("permite eval e omite HSTS fora de produção", () => {
    const headers = buildSecurityHeaders({ isProduction: false, isVercelPreview: false });
    const csp = headers.find(({ key }) => key === "Content-Security-Policy").value;
    expect(csp).toContain("'unsafe-eval'");
    expect(headers.some(({ key }) => key === "Strict-Transport-Security")).toBe(false);
  });
});
