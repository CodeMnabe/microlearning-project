import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  requireOrgForAssistant,
  requireOrgForAutomationRule,
  requireOrgForScheduledBroadcast,
  requireOrgForTag,
  requireOrgForThread,
  requireOrgForUser,
  requireOwnedOrg,
  requirePrivilegedUser,
} from "@/lib/auth/guards";
import * as serverUtils from "@/utils/supabase/server";
import * as adminUtils from "@/lib/db/admin";

vi.mock("@/utils/supabase/server", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/db/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

const USER_ID = "user-123";
const OTHER_USER_ID = "user-456";
const UUID = "11111111-1111-4111-8111-111111111111";

function queryResult(data, error = null) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data, error }),
      })),
    })),
  };
}

describe("MFA guards", () => {
  let adminFrom;
  let getAuthenticatorAssuranceLevel;
  let listFactors;
  let mockAuth;

  beforeEach(() => {
    vi.clearAllMocks();

    getAuthenticatorAssuranceLevel = vi.fn().mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2" },
      error: null,
    });
    listFactors = vi.fn().mockResolvedValue({
      data: {
        all: [{ id: "factor-id", status: "verified", factor_type: "totp" }],
      },
      error: null,
    });
    adminFrom = vi.fn(() =>
      queryResult({ id: 1, owner_user_id: USER_ID, organization_id: 1 }),
    );
    mockAuth = {
      user: { id: USER_ID, user_metadata: {}, app_metadata: {} },
      supabase: {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: USER_ID } },
            error: null,
          }),
          mfa: { getAuthenticatorAssuranceLevel, listFactors },
        },
      },
      admin: { from: adminFrom },
    };

    serverUtils.default.mockResolvedValue(mockAuth.supabase);
    adminUtils.getSupabaseAdminClient.mockReturnValue(mockAuth.admin);
  });

  it("sessão ausente devolve 401", async () => {
    serverUtils.default.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "No session" },
        }),
      },
    });

    const result = await requirePrivilegedUser();
    expect(result.error.status).toBe(401);
  });

  it.each([
    ["aal1", "aal1"],
    ["aal1", "aal2"],
    ["aal2", "aal1"],
  ])("%s/%s devolve 403", async (currentLevel, nextLevel) => {
    getAuthenticatorAssuranceLevel.mockResolvedValueOnce({
      data: { currentLevel, nextLevel },
      error: null,
    });

    const result = await requirePrivilegedUser(mockAuth);
    expect(result.error.status).toBe(403);
    expect(await result.error.json()).toEqual({ error: "MFA required" });
  });

  it("aal2/aal2 é permitido e recebe a marca privada", async () => {
    const result = await requirePrivilegedUser(mockAuth);

    expect(result.error).toBeUndefined();
    expect(result.aal).toBe("aal2");
    expect(result.nextAal).toBe("aal2");
    expect(Reflect.ownKeys(result).some((key) => typeof key === "symbol")).toBe(
      true,
    );
  });

  it("fator eliminado com JWT stale devolve 403 sem marca privada", async () => {
    listFactors.mockResolvedValueOnce({
      data: { all: [] },
      error: null,
    });

    const result = await requirePrivilegedUser(mockAuth);
    expect(result.error.status).toBe(403);
    expect(listFactors).toHaveBeenCalledOnce();
    expect(Reflect.ownKeys(result).some((key) => typeof key === "symbol")).toBe(
      false,
    );
  });

  it.each([
    { aalValidated: true },
    { mfaValidated: true },
    { aal: "aal2" },
    { currentLevel: "aal2" },
    { nextLevel: "aal2" },
    { user: { user_metadata: { aal2: true }, app_metadata: {} } },
    { user: { user_metadata: {}, app_metadata: { aal2: true } } },
  ])("propriedades públicas não fazem bypass: %j", async (payload) => {
    const existingAuth = { ...mockAuth, ...payload };
    if (payload.user) {
      existingAuth.user = { ...mockAuth.user, ...payload.user };
    }
    getAuthenticatorAssuranceLevel.mockResolvedValueOnce({
      data: { currentLevel: "aal2", nextLevel: "aal1" },
      error: null,
    });

    const result = await requirePrivilegedUser(existingAuth);
    expect(result.error.status).toBe(403);
    expect(getAuthenticatorAssuranceLevel).toHaveBeenCalledOnce();
  });

  it("erro da biblioteca devolve 500 genérico", async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValueOnce({
      data: null,
      error: { message: "provider detail" },
    });

    const result = await requirePrivilegedUser(mockAuth);
    expect(result.error.status).toBe(500);
    expect(await result.error.json()).toEqual({
      error: "Failed to determine assurance level",
    });
  });

  it("exceção da biblioteca devolve 500 genérico", async () => {
    getAuthenticatorAssuranceLevel.mockRejectedValueOnce(
      new Error("provider detail"),
    );

    const result = await requirePrivilegedUser(mockAuth);
    expect(result.error.status).toBe(500);
    expect(await result.error.json()).toEqual({
      error: "Failed to determine assurance level",
    });
  });

  it("a marca privada reutiliza AAL apenas dentro do contexto validado", async () => {
    const validated = await requirePrivilegedUser(mockAuth);
    const reused = await requirePrivilegedUser(validated);

    expect(reused.error).toBeUndefined();
    expect(getAuthenticatorAssuranceLevel).toHaveBeenCalledOnce();
  });

  it("AAL é verificado antes do primeiro lookup administrativo", async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValueOnce({
      data: { currentLevel: "aal2", nextLevel: "aal1" },
      error: null,
    });

    const result = await requireOwnedOrg(1, mockAuth);
    expect(result.error.status).toBe(403);
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it.each([
    [
      "requireOrgForUser",
      () => requireOrgForUser(1),
      "user",
      { id: 1, organization_id: 1 },
    ],
    [
      "requireOrgForAssistant",
      () => requireOrgForAssistant(1),
      "assistant",
      { id: 1, organization_id: 1 },
    ],
    [
      "requireOrgForThread",
      () => requireOrgForThread(1),
      "thread",
      { id: 1, organization_id: 1 },
    ],
    [
      "requireOrgForTag",
      () => requireOrgForTag(1),
      "tags",
      { id: 1, org_id: 1 },
    ],
    [
      "requireOrgForScheduledBroadcast",
      () => requireOrgForScheduledBroadcast(UUID),
      "scheduled_broadcast",
      { id: UUID, organization_id: 1 },
    ],
    [
      "requireOrgForAutomationRule",
      () => requireOrgForAutomationRule(UUID),
      "automation_rule",
      { id: UUID, organization_id: 1 },
    ],
  ])(
    "%s verifica MFA antes do lookup real",
    async (_name, call, table, row) => {
      const order = [];
      getAuthenticatorAssuranceLevel.mockImplementationOnce(async () => {
        order.push("mfa");
        return {
          data: { currentLevel: "aal2", nextLevel: "aal2" },
          error: null,
        };
      });
      adminFrom.mockImplementation((actualTable) => {
        order.push(`admin_${actualTable}`);
        if (actualTable === table) return queryResult(row);
        return queryResult({ id: 1, owner_user_id: USER_ID });
      });

      const result = await call();
      expect(result.error).toBeUndefined();
      expect(order).toEqual(["mfa", `admin_${table}`, "admin_organization"]);
    },
  );

  it("thread com organization_id não faz lookup adicional de user/assistant", async () => {
    adminFrom.mockImplementation((table) => {
      if (table === "thread") {
        return queryResult({ id: 1, organization_id: 1 });
      }
      if (table === "organization") {
        return queryResult({ id: 1, owner_user_id: USER_ID });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await requireOrgForThread(1);
    expect(result.error).toBeUndefined();
    expect(adminFrom.mock.calls.map(([table]) => table)).toEqual([
      "thread",
      "organization",
    ]);
  });

  const hiddenResourceCases = [
    [
      "user",
      () => requireOrgForUser(1),
      "user",
      (organizationId) => ({ id: 1, organization_id: organizationId }),
    ],
    [
      "assistant",
      () => requireOrgForAssistant(1),
      "assistant",
      (organizationId) => ({ id: 1, organization_id: organizationId }),
    ],
    [
      "thread",
      () => requireOrgForThread(1),
      "thread",
      (organizationId) => ({ id: 1, organization_id: organizationId }),
    ],
    [
      "tag",
      () => requireOrgForTag(1),
      "tags",
      (organizationId) => ({ id: 1, org_id: organizationId }),
    ],
    [
      "scheduled broadcast",
      () => requireOrgForScheduledBroadcast(UUID),
      "scheduled_broadcast",
      (organizationId) => ({ id: UUID, organization_id: organizationId }),
    ],
    [
      "automation rule",
      () => requireOrgForAutomationRule(UUID),
      "automation_rule",
      (organizationId) => ({ id: UUID, organization_id: organizationId }),
    ],
  ];

  it.each(hiddenResourceCases)(
    "%s inexistente e cross-tenant são publicamente indistinguíveis",
    async (_name, call, table, makeRow) => {
      adminFrom.mockImplementation((actualTable) => {
        if (actualTable === table) return queryResult(null);
        return queryResult(null);
      });
      const missing = await call();

      adminFrom.mockImplementation((actualTable) => {
        if (actualTable === table) return queryResult(makeRow(2));
        return queryResult({ id: 2, owner_user_id: OTHER_USER_ID });
      });
      const crossTenant = await call();

      expect(missing.error.status).toBe(404);
      expect(crossTenant.error.status).toBe(404);
      expect(await missing.error.json()).toEqual({
        error: "Resource not found",
      });
      expect(await crossTenant.error.json()).toEqual({
        error: "Resource not found",
      });
    },
  );

  it("objeto sem cliente SSR válido falha fechado", async () => {
    const result = await requirePrivilegedUser({ user: mockAuth.user });
    expect(result.error.status).toBe(500);
  });
});
