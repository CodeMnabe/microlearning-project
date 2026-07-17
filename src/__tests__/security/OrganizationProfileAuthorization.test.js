import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateOrganizationProfile: vi.fn(),
  requireOwnedOrg: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@/lib/repos/organizations.repo", () => ({
  updateOrganizationProfile: mocks.updateOrganizationProfile,
}));

vi.mock("@/lib/auth/guards", () => ({
  requireOwnedOrg: mocks.requireOwnedOrg,
  requireUser: mocks.requireUser,
  handleApiError: (error) =>
    Response.json(
      { error: error.message },
      { status: error.status || 500 },
    ),
}));

import { PATCH, POST } from "@/app/api/organizations/route.js";

function patchOrganization(body) {
  return PATCH(
    new Request("https://app.example/api/organizations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("Organization profile authorization boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOwnedOrg.mockResolvedValue({ orgId: 7 });
    mocks.requireUser.mockResolvedValue({ user: { id: "owner-user-id" } });
    mocks.updateOrganizationProfile.mockImplementation(
      async (id, updates) => ({ id, ...updates }),
    );
  });

  it.each(["channelId", "channel_id"])(
    "rejects client-controlled organization creation through %s",
    async (field) => {
      const response = await POST(
        new Request("https://app.example/api/organizations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Example Organization",
            [field]: "123e4567-e89b-42d3-a456-426614174000",
          }),
        }),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: expect.stringContaining("verified backend provisioning"),
      });
    },
  );

  it("does not create an organization without verified Bird provisioning", async () => {
    const response = await POST(
      new Request("https://app.example/api/organizations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Example Organization",
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("verified backend Bird provisioning"),
    });
  });

  it("allows an owner to update only the documented self-service fields", async () => {
    const body = {
      organizationId: 7,
      name: " Example Organization ",
      theme: { primary: "#123456", secondary: "#abc" },
      logo_url: " https://cdn.example/logo.png ",
      default_phone_country_code: "+351",
    };

    const response = await patchOrganization(body);

    expect(response.status).toBe(200);
    expect(mocks.requireOwnedOrg).toHaveBeenCalledWith(7);
    expect(mocks.updateOrganizationProfile).toHaveBeenCalledWith(7, {
      name: "Example Organization",
      theme: { primary: "#123456", secondary: "#abc" },
      logo_url: "https://cdn.example/logo.png",
      default_phone_country_code: "+351",
    });
  });

  it.each([
    "plan_id",
    "max_users_override",
    "channel_id",
    "teams_tenant_id",
    "waba_id",
    "waba_namespace",
    "owner_user_id",
    "id",
    "created_at",
    "unknown_field",
  ])("rejects the non-self-service field %s", async (field) => {
    const response = await patchOrganization({
      organizationId: 7,
      theme: { primary: "#123456", secondary: "#abcdef" },
      [field]: "not-allowed",
    });

    expect(response.status).toBe(400);
    expect(mocks.requireOwnedOrg).not.toHaveBeenCalled();
    expect(mocks.updateOrganizationProfile).not.toHaveBeenCalled();
  });

  it("blocks an organization owned by another authenticated user", async () => {
    mocks.requireOwnedOrg.mockResolvedValue({
      error: Response.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await patchOrganization({
      organizationId: 8,
      name: "Other tenant",
    });

    expect(response.status).toBe(403);
    expect(mocks.updateOrganizationProfile).not.toHaveBeenCalled();
  });

  it("blocks an unauthenticated user", async () => {
    mocks.requireOwnedOrg.mockResolvedValue({
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await patchOrganization({
      organizationId: 7,
      name: "Example",
    });

    expect(response.status).toBe(401);
    expect(mocks.updateOrganizationProfile).not.toHaveBeenCalled();
  });

  it("rejects an invalid self-service value", async () => {
    const response = await patchOrganization({
      organizationId: 7,
      theme: { primary: "red", secondary: "#abcdef" },
    });

    expect(response.status).toBe(400);
    expect(mocks.updateOrganizationProfile).not.toHaveBeenCalled();
  });
});
