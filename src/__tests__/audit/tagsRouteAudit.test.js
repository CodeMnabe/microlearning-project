/**
 * Verifica que uma rota de API regista a ação no histórico
 * depois da operação ter sucesso, e não a regista quando falha.
 *
 * Usa a rota das etiquetas como exemplo; as restantes rotas
 * seguem o mesmo padrão.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createTag: vi.fn(),
  deleteTag: vi.fn(),
  recordAuditEvent: vi.fn(),
  requireOwnedOrg: vi.fn(),
  requireOrgForTag: vi.fn(),
}));

vi.mock("@/lib/repos/tag.repo.js", () => ({
  getTagsInOrg: vi.fn(),
  createTag: (...args) => mocks.createTag(...args),
  updateTag: vi.fn(),
  deleteTag: (...args) => mocks.deleteTag(...args),
}));

vi.mock("@/lib/services/audit/recordAuditEvent", () => ({
  recordAuditEvent: (...args) => mocks.recordAuditEvent(...args),
}));

vi.mock("@/lib/auth/guards", async () => {
  const { NextResponse } = await import("next/server");

  return {
    cleanPatch: (input = {}, allowed = []) =>
      Object.fromEntries(
        Object.entries(input).filter(
          ([key, value]) => allowed.includes(key) && value !== undefined,
        ),
      ),
    handleApiError: (error) =>
      NextResponse.json(
        { error: error?.message || "failed" },
        { status: error?.status || 500 },
      ),
    requireOwnedOrg: (...args) => mocks.requireOwnedOrg(...args),
    requireOrgForTag: (...args) => mocks.requireOrgForTag(...args),
  };
});

import { POST, DELETE } from "@/app/api/tags/route";

const orgAuth = {
  orgId: 3,
  org: { id: 3 },
  user: { id: "user-1", email: "owner@x.pt" },
  admin: {},
};

describe("registo de atividade na rota das etiquetas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOwnedOrg.mockResolvedValue(orgAuth);
    mocks.requireOrgForTag.mockResolvedValue({
      ...orgAuth,
      tagId: 12,
      tag: { id: 12, org_id: 3, name: "Antiga" },
    });
    mocks.recordAuditEvent.mockResolvedValue({});
  });

  it("regista tag.created depois de criar", async () => {
    mocks.createTag.mockResolvedValue({ id: 12, name: "VIP" });

    const res = await POST(
      new Request("http://localhost/api/tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgId: 3, name: "VIP", color: "#000" }),
      }),
    );

    expect(res.status).toBe(201);

    expect(mocks.recordAuditEvent).toHaveBeenCalledTimes(1);
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(orgAuth, {
      action: "tag.created",
      entityId: 12,
      entityLabel: "VIP",
    });
  });

  it("não regista nada quando a criação falha", async () => {
    mocks.createTag.mockRejectedValue(new Error("boom"));

    const res = await POST(
      new Request("http://localhost/api/tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgId: 3, name: "VIP" }),
      }),
    );

    expect(res.status).toBe(500);
    expect(mocks.recordAuditEvent).not.toHaveBeenCalled();
  });

  it("regista tag.deleted com o nome que a etiqueta tinha", async () => {
    mocks.deleteTag.mockResolvedValue(true);

    const res = await DELETE(new Request("http://localhost/api/tags?id=12"));

    expect(res.status).toBe(200);

    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 3 }),
      {
        action: "tag.deleted",
        entityId: 12,
        entityLabel: "Antiga",
      },
    );
  });

  it("não regista quando o guard recusa o pedido", async () => {
    const { NextResponse } = await import("next/server");

    mocks.requireOrgForTag.mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const res = await DELETE(new Request("http://localhost/api/tags?id=12"));

    expect(res.status).toBe(403);
    expect(mocks.deleteTag).not.toHaveBeenCalled();
    expect(mocks.recordAuditEvent).not.toHaveBeenCalled();
  });
});
