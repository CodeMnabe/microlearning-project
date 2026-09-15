// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadOrganizationFavicon: vi.fn(),
  saveOrganizationFavicon: vi.fn(),
  resetOrganizationFavicon: vi.fn(),
  requireOwnedOrg: vi.fn(),
}));

vi.mock("@/lib/services/organizationFavicon.service", () => ({
  loadOrganizationFavicon: mocks.loadOrganizationFavicon,
  saveOrganizationFavicon: mocks.saveOrganizationFavicon,
  resetOrganizationFavicon: mocks.resetOrganizationFavicon,
}));

vi.mock("@/lib/auth/guards", () => ({
  requireOwnedOrg: mocks.requireOwnedOrg,
  parsePositiveInt: (value) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null,
  handleApiError: (error) => Response.json({ error: error.message }, { status: error.status || 500 }),
}));

import { GET, POST, DELETE } from "@/app/api/organizations/favicon/route";

function request(query) {
  return new Request(`http://localhost/api/organizations/favicon${query}`);
}

describe("GET /api/organizations/favicon", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the rendered PNG with long-lived caching", async () => {
    mocks.loadOrganizationFavicon.mockResolvedValue(Buffer.from("png-bytes"));

    const response = await GET(request("?path=org-logos%2F7%2Flogo.png"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(mocks.loadOrganizationFavicon).toHaveBeenCalledWith(
      "org-logos/7/logo.png",
    );
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe(
      "png-bytes",
    );
  });

  it("returns 400 for an invalid path", async () => {
    mocks.loadOrganizationFavicon.mockRejectedValue(
      Object.assign(new Error("Invalid logo path"), { status: 400 }),
    );

    const response = await GET(request(""));
    expect(response.status).toBe(400);
  });

  it("returns 404 when the logo object no longer exists", async () => {
    mocks.loadOrganizationFavicon.mockRejectedValue(
      Object.assign(new Error("Logo not found"), { status: 404 }),
    );

    const response = await GET(request("?path=org-logos%2F7%2Fgone.png"));
    expect(response.status).toBe(404);
  });
});

function mutationRequest(method, orgId = 7) {
  if (method === "DELETE") return new Request("http://localhost/api/organizations/favicon", {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId }),
  });
  const body = new FormData();
  body.set("orgId", String(orgId));
  body.set("favicon", new Blob(["png"], { type: "image/png" }), "icon.png");
  return new Request("http://localhost/api/organizations/favicon", { method, body });
}

describe("permissÃµes de alteraÃ§Ã£o do favicon", () => {
  beforeEach(() => vi.resetAllMocks());
  it.each([401, 403])("recusa upload e remoÃ§Ã£o sem autorizaÃ§Ã£o (%s)", async (status) => {
    mocks.requireOwnedOrg.mockResolvedValue({ error: Response.json({}, { status }) });
    expect((await POST(mutationRequest("POST"))).status).toBe(status);
    const response = await DELETE(mutationRequest("DELETE"));
    expect(response.status).toBe(status);
    expect(mocks.saveOrganizationFavicon).not.toHaveBeenCalled();
    expect(mocks.resetOrganizationFavicon).not.toHaveBeenCalled();
  });
  it("usa a organizaÃ§Ã£o validada pelo controlo de acesso", async () => {
    mocks.requireOwnedOrg.mockResolvedValue({ orgId: 7 });
    mocks.saveOrganizationFavicon.mockResolvedValue({ id: 7, favicon_url: "icon" });
    expect((await POST(mutationRequest("POST", 999))).status).toBe(200);
    expect(mocks.saveOrganizationFavicon).toHaveBeenCalledWith(7, expect.objectContaining({ name: "icon.png" }));
    expect((await DELETE(mutationRequest("DELETE", 999))).status).toBe(200);
    expect(mocks.resetOrganizationFavicon).toHaveBeenCalledWith(7);
  });
  it("rejeita uma organizaÃ§Ã£o invÃ¡lida", async () => {
    expect((await POST(mutationRequest("POST", 0))).status).toBe(400);
    expect((await DELETE(mutationRequest("DELETE", 0))).status).toBe(400);
    expect(mocks.requireOwnedOrg).not.toHaveBeenCalled();
  });
});
