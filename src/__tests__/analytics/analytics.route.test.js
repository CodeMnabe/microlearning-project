// @vitest-environment node

/**
 * Testes da route de métricas.
 *
 * Mockamos o guard e o service para isolar o que interessa aqui: que a
 * route recusa sem sessão, recusa organização alheia, e só chama o
 * service quando a autorização passa.
 *
 * O padrão de mock é o mesmo de `users.backend.routes.test.js`, para a
 * camada Analytics não inventar uma forma diferente de testar routes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  requireOwnedOrg: vi.fn(),
  getAnalyticsOverview: vi.fn(),
}));

vi.mock("@/lib/auth/guards", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    requireOwnedOrg: mocks.requireOwnedOrg,
  };
});

vi.mock("@/lib/services/analytics/analytics.service", () => ({
  getAnalyticsOverview: mocks.getAnalyticsOverview,
}));

import { GET } from "@/app/api/analytics/overview/route";

function request(query) {
  return new Request(`http://localhost/api/analytics/overview?${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/analytics/overview", () => {
  it("devolve as métricas quando a autorização passa", async () => {
    mocks.requireOwnedOrg.mockResolvedValue({ orgId: 7 });
    mocks.getAnalyticsOverview.mockResolvedValue({ ok: true, users: {} });

    const response = await GET(request("orgId=7&period=30d"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });

    expect(mocks.getAnalyticsOverview).toHaveBeenCalledWith({
      orgId: 7,
      period: "30d",
    });
  });

  it("recusa quem não tem sessão", async () => {
    mocks.requireOwnedOrg.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(request("orgId=7"));

    expect(response.status).toBe(401);

    // O que interessa mesmo: o service nunca chega a correr.
    expect(mocks.getAnalyticsOverview).not.toHaveBeenCalled();
  });

  it("recusa a organização de outra pessoa", async () => {
    mocks.requireOwnedOrg.mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    // Sessão válida, mas orgId trocado na query string — era isto que
    // antes bastava para ler as métricas de outra organização.
    const response = await GET(request("orgId=999"));

    expect(response.status).toBe(403);
    expect(mocks.getAnalyticsOverview).not.toHaveBeenCalled();
  });

  it("usa o orgId validado pelo guard, não o da query string", async () => {
    // O guard devolve o valor já convertido a inteiro. Se a route
    // voltasse a ler o parâmetro cru, contornava a validação.
    mocks.requireOwnedOrg.mockResolvedValue({ orgId: 7 });
    mocks.getAnalyticsOverview.mockResolvedValue({ ok: true });

    await GET(request("orgId=7abc"));

    expect(mocks.getAnalyticsOverview).toHaveBeenCalledWith({
      orgId: 7,
      period: "all",
    });
  });

  it("usa o período 'all' quando nenhum é pedido", async () => {
    mocks.requireOwnedOrg.mockResolvedValue({ orgId: 7 });
    mocks.getAnalyticsOverview.mockResolvedValue({ ok: true });

    await GET(request("orgId=7"));

    expect(mocks.getAnalyticsOverview).toHaveBeenCalledWith({
      orgId: 7,
      period: "all",
    });
  });

  it("devolve 400 quando o service rejeita o período", async () => {
    mocks.requireOwnedOrg.mockResolvedValue({ orgId: 7 });

    const invalidPeriod = new Error("Invalid period");
    invalidPeriod.status = 400;
    mocks.getAnalyticsOverview.mockRejectedValue(invalidPeriod);

    const response = await GET(request("orgId=7&period=banana"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Invalid period",
    });
  });
});
