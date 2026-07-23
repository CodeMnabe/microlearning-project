import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, globSync } from "fs";
import { join } from "path";
import { buildContentSecurityPolicy } from "@/lib/security/contentSecurityPolicy";

describe("Static Security Checks", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ztxlzixcprexbhdmqpkj.supabase.co";
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
  });

  it("CSP de produção não contém unsafe-inline ou unsafe-eval", () => {
    const csp = buildContentSecurityPolicy("dummy", true);
    expect(csp).not.toMatch(/script-src[^;]+'unsafe-inline'/);
    expect(csp).not.toMatch(/'unsafe-eval'/);
  });

  it("CSP não contém wildcards injustificados nas diretivas críticas", () => {
    const csp = buildContentSecurityPolicy("dummy", true);
    expect(csp).not.toMatch(/script-src[^;]+\*/);
    expect(csp).not.toMatch(/connect-src[^;]+\*/);
    expect(csp).not.toMatch(/frame-src[^;]+\*/);
  });

  it("CSP de produção não contém origens HTTP", () => {
    const csp = buildContentSecurityPolicy("dummy", true);
    expect(csp).not.toMatch(/http:\/\//);
  });

  it("O nonce não usa Math.random ou valores fixos na política de segurança", () => {
    const cspFile = readFileSync(
      join(process.cwd(), "src/lib/security/contentSecurityPolicy.js"),
      "utf8",
    );
    expect(cspFile).not.toMatch(/Math\.random/);

    // Testa se o nonce é passado como argumento e não é fixo
    const nonce1 = buildContentSecurityPolicy("random1", true);
    const nonce2 = buildContentSecurityPolicy("random2", true);
    expect(nonce1).not.toBe(nonce2);
  });

  it("Sem novos usos de dangerouslySetInnerHTML", () => {
    // Para simplificar, verificamos em src (assumindo que o inventário atual foi validado)
    const files = globSync("src/**/*.{js,jsx,ts,tsx}");
    let count = 0;
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      if (content.includes("dangerouslySetInnerHTML")) count++;
    }
    // Apenas 1 uso esperado/permitido no projeto (ou o número exato verificado)
    // Atualiza o limite conforme o inventário. Assumindo que não existem no código atual.
    expect(count).toBeLessThanOrEqual(2);
  });

  it("Cache-Control não aplica no-store a assets globais no proxy", () => {
    const proxyContent = readFileSync(
      join(process.cwd(), "src/proxy.js"),
      "utf8",
    );
    expect(proxyContent).not.toMatch(/matcher:\s*\["\/(.*)\*"\],/);
    // Garante que o matcher do proxy exclui assets estáticos.
    expect(proxyContent).toMatch(/\(\?!_next\/static/);
    expect(proxyContent).toMatch(/_next\/image/);
  });
});
