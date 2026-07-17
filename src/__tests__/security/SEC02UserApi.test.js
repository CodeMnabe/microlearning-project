import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOwnedOrg: vi.fn(),
  requireOrgForUser: vi.fn(),
  assertAssistantBelongsToOrg: vi.fn(),
  assertTagsBelongToOrg: vi.fn(),
  createUserWithAutomations: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireOwnedOrg: mocks.requireOwnedOrg,
  requireOrgForUser: mocks.requireOrgForUser,
  assertAssistantBelongsToOrg: mocks.assertAssistantBelongsToOrg,
  assertTagsBelongToOrg: mocks.assertTagsBelongToOrg,
  handleApiError: (error) =>
    Response.json(
      { error: error.message },
      { status: error.status || 500 },
    ),
}));

vi.mock("@/lib/repos/user.repo", () => ({
  createUser: vi.fn(),
  getUsersInOrg: vi.fn(),
  updateUser: mocks.updateUser,
  deleteUser: mocks.deleteUser,
}));

vi.mock("@/lib/services/automations/createUserWithAutomations", () => ({
  createUserWithAutomations: mocks.createUserWithAutomations,
}));

import { PATCH, POST } from "@/app/api/users/route.js";

function apiRequest(method, body) {
  return new Request("https://app.example/api/users", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("SEC-02 authorized user mutation paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOwnedOrg.mockResolvedValue({ orgId: 7, admin: {} });
    mocks.requireOrgForUser.mockResolvedValue({
      orgId: 7,
      userId: 22,
      admin: {},
    });
    mocks.assertAssistantBelongsToOrg.mockImplementation(
      async (_admin, _orgId, assistantId) => assistantId ?? null,
    );
    mocks.createUserWithAutomations.mockResolvedValue({ id: 22 });
    mocks.updateUser.mockResolvedValue({ id: 22 });
  });

  it("keeps legitimate creation through the authorized API functional", async () => {
    const response = await POST(
      apiRequest("POST", {
        organizationId: 7,
        name: "Legitimate user",
        assistantId: 3,
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.requireOwnedOrg).toHaveBeenCalledWith(7);
    expect(mocks.assertAssistantBelongsToOrg).toHaveBeenCalledWith({}, 7, 3);
    expect(mocks.createUserWithAutomations).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 7, assistantId: 3 }),
    );
  });

  it("allows creation in the last available plan slot", async () => {
    mocks.createUserWithAutomations.mockResolvedValue({ id: 99 });

    const response = await POST(
      apiRequest("POST", {
        organizationId: 7,
        name: "Last allowed user",
      }),
    );

    expect(response.status).toBe(201);
  });

  it("returns conflict when the transactional RPC reports the plan limit", async () => {
    const error = new Error("User limit reached for this organization");
    error.code = "USER_LIMIT_REACHED";
    mocks.createUserWithAutomations.mockRejectedValue(error);

    const response = await POST(
      apiRequest("POST", {
        organizationId: 7,
        name: "One too many",
      }),
    );

    expect(response.status).toBe(409);
  });

  it("rejects a cross-tenant assistant during creation", async () => {
    const error = new Error("Assistant does not belong to this organization");
    error.status = 403;
    mocks.assertAssistantBelongsToOrg.mockRejectedValue(error);

    const response = await POST(
      apiRequest("POST", {
        organizationId: 7,
        name: "Invalid relation",
        assistantId: 44,
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.createUserWithAutomations).not.toHaveBeenCalled();
  });

  it("rejects a cross-tenant assistant during update", async () => {
    const error = new Error("Assistant does not belong to this organization");
    error.status = 403;
    mocks.assertAssistantBelongsToOrg.mockRejectedValue(error);

    const response = await PATCH(
      apiRequest("PATCH", { id: 22, assistantId: 44 }),
    );

    expect(response.status).toBe(403);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
