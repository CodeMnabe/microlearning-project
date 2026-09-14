import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadOrganizationFavicon: vi.fn(),
}));

vi.mock("@/lib/services/organizationFavicon.service", () => ({
  loadOrganizationFavicon: mocks.loadOrganizationFavicon,
}));

import { GET } from "@/app/api/organizations/favicon/route";

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
