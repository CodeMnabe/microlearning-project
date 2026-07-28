import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { checkMfaEnforcement, isOrganizationOwner } from "@/lib/auth/mfa";
import { proxy } from "@/proxy";
import { updateSession } from "@/utils/supabase/middleware";
import { getMfaStatus } from "@/lib/auth/mfa";

const mocks = vi.hoisted(() => ({
  getMfaStatus: vi.fn(),
  updateSession: vi.fn(),
  adminFrom: vi.fn(),
}));

vi.mock("next-intl/middleware", () => ({
  default: vi.fn(() => vi.fn(() => NextResponse.next())),
}));

vi.mock("@/utils/supabase/middleware", () => ({
  updateSession: mocks.updateSession,
}));

vi.mock("@/lib/auth/mfa", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getMfaStatus: mocks.getMfaStatus,
  };
});

vi.mock("@/lib/db/admin", () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: mocks.adminFrom,
  })),
}));

function request(path) {
  const value = new Request(`http://localhost${path}`);
  value.nextUrl = new URL(value.url);
  return value;
}

function session({ user = { id: "owner-id" } } = {}) {
  mocks.updateSession.mockResolvedValue({
    response: NextResponse.next(),
    user,
    supabase: { auth: { mfa: {} } },
  });
}

describe("MFA enforcement decision", () => {
  it.each([
    ["aal1", "aal1", "enrollment"],
    ["aal1", "aal2", "challenge"],
    ["aal2", "aal2", "allow"],
    ["aal2", "aal1", "enrollment"],
  ])("owner %s/%s resulta em %s", (currentLevel, nextLevel, expectedAction) => {
    expect(
      checkMfaEnforcement({
        isPrivileged: true,
        currentLevel,
        nextLevel,
      }),
    ).toMatchObject({ action: expectedAction });
  });

  it("não-owner segue a política atual sem MFA obrigatório", () => {
    expect(
      checkMfaEnforcement({
        isPrivileged: false,
        currentLevel: "aal1",
        nextLevel: "aal1",
      }),
    ).toEqual({ required: false, action: "allow" });
  });

  it("isOrganizationOwner usa owner_user_id", async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: 1 }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const limit = vi.fn(() => ({ maybeSingle }));
    const eq = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ eq }));
    mocks.adminFrom.mockReturnValue({ select });

    await expect(isOrganizationOwner("owner-id")).resolves.toBe(true);
    await expect(isOrganizationOwner("regular-id")).resolves.toBe(false);
    expect(eq).toHaveBeenNthCalledWith(1, "owner_user_id", "owner-id");
    expect(eq).toHaveBeenNthCalledWith(2, "owner_user_id", "regular-id");
  });
});

describe("Proxy MFA enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session();
  });

  it.each([
    [
      "/pt/users",
      { requiresEnrollment: true, requiresChallenge: false },
      "/pt/mfa/enrollment",
    ],
    [
      "/en/users",
      { requiresEnrollment: false, requiresChallenge: true },
      "/en/mfa/challenge",
    ],
    [
      "/users",
      { requiresEnrollment: true, requiresChallenge: false },
      "/mfa/enrollment",
    ],
  ])("redireciona %s para %s", async (path, status, expectedPath) => {
    mocks.getMfaStatus.mockResolvedValue(status);

    const response = await proxy(request(path));
    const location = new URL(response.headers.get("location"));

    expect(response.status).toBe(307);
    expect(location.pathname).toBe(expectedPath);
    expect(location.searchParams.get("next")).toBe(
      new URL(`http://localhost${path}`).pathname,
    );
  });

  it("owner aal2/aal2 acede à página privada", async () => {
    mocks.getMfaStatus.mockResolvedValue({
      requiresEnrollment: false,
      requiresChallenge: false,
    });

    const response = await proxy(request("/pt/users"));
    expect(response.status).toBe(200);
    expect(response.headers.has("location")).toBe(false);
  });

  it("não-owner segue a política real do produto", async () => {
    mocks.getMfaStatus.mockResolvedValue({
      isPrivileged: false,
      requiresEnrollment: false,
      requiresChallenge: false,
    });

    const response = await proxy(request("/en/users"));
    expect(response.status).toBe(200);
  });

  it.each([
    "/pt/mfa/enrollment",
    "/en/mfa/enrollment",
    "/pt/mfa/challenge",
    "/en/mfa/challenge",
    "/api/auth/signout",
    "/api/auth/callback",
    "/pt/reset/confirm",
    "/en/login",
  ])("%s não entra no enforcement de páginas privadas", async (path) => {
    const response = await proxy(request(path));

    expect(response.status).toBe(200);
    expect(mocks.getMfaStatus).not.toHaveBeenCalled();
  });

  it("preserva o cookie PKCE no callback sem executar refresh de sessão", async () => {
    const callbackRequest = request("/api/auth/callback?code=local-code");
    callbackRequest.headers.set(
      "cookie",
      "sb-local-auth-token-code-verifier=local-verifier",
    );

    const response = await proxy(callbackRequest);

    expect(response.status).toBe(200);
    expect(mocks.updateSession).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-request-cookie")).toContain(
      "sb-local-auth-token-code-verifier=local-verifier",
    );
  });

  it("erro ao determinar AAL falha fechado", async () => {
    mocks.getMfaStatus.mockRejectedValue(new Error("local failure"));

    const response = await proxy(request("/pt/users"));
    expect(new URL(response.headers.get("location")).pathname).toBe(
      "/pt/login",
    );
  });

  it("next externo fornecido pelo cliente não é preservado", async () => {
    mocks.getMfaStatus.mockResolvedValue({
      requiresEnrollment: false,
      requiresChallenge: true,
    });

    const response = await proxy(
      request("/pt/users?next=https://attacker.example"),
    );
    const location = new URL(response.headers.get("location"));

    expect(location.origin).toBe("http://localhost");
    expect(location.searchParams.get("next")).toBe("/pt/users");
  });

  it("resposta final sensível mantém private e no-store", async () => {
    mocks.getMfaStatus.mockResolvedValue({
      requiresEnrollment: false,
      requiresChallenge: false,
    });

    const response = await proxy(request("/pt/users"));
    expect(response.headers.get("Cache-Control")).toContain("private");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Cache-Control")).not.toContain("s-maxage");
  });
});
