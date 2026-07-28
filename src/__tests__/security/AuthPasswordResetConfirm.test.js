import { beforeEach, describe, expect, it, vi } from "vitest";
import { changePassword } from "@/app/[locale]/(auth)/reset/confirm/actions";
import createSupabaseServerClient from "@/utils/supabase/server";
import { logger } from "@/lib/observability/logger";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  default: mocks.createSupabaseServerClient,
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    info: mocks.loggerInfo,
  },
}));

const VALID_PASSWORD = "Str0ng!Password";

describe("password reset confirmation Server Action", () => {
  let getUser;
  let updateUser;
  let signOut;

  beforeEach(() => {
    vi.clearAllMocks();
    getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "sentinel-user" } },
      error: null,
    });
    updateUser = vi.fn().mockResolvedValue({ error: null });
    signOut = vi.fn().mockResolvedValue({ error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser, updateUser, signOut },
    });
  });

  it("rejeita sessão ausente com resposta genérica", async () => {
    getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "expired token detail" },
    });

    const result = await changePassword({
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });

    expect(result).toEqual({
      success: false,
      error: "password_change_failed",
    });
    expect(updateUser).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("expired token detail");
  });

  it.each([
    ["menos de 12", "Short1!", "Short1!"],
    ["sem maiúscula", "lowercase123!", "lowercase123!"],
    ["sem minúscula", "UPPERCASE123!", "UPPERCASE123!"],
    ["sem número", "NoDigitsHere!", "NoDigitsHere!"],
    ["sem símbolo", "NoSymbolHere123", "NoSymbolHere123"],
    ["mais de 128 bytes", `Aa1!${"é".repeat(63)}`, `Aa1!${"é".repeat(63)}`],
    ["confirmação diferente", VALID_PASSWORD, "Different1!Password"],
  ])(
    "rejeita %s antes do cliente SSR",
    async (_name, password, confirmation) => {
      const result = await changePassword({
        password,
        confirmPassword: confirmation,
      });

      expect(result.success).toBe(false);
      expect(createSupabaseServerClient).not.toHaveBeenCalled();
      expect(updateUser).not.toHaveBeenCalled();
    },
  );

  it("atualiza no servidor, termina a sessão local e responde genericamente", async () => {
    const result = await changePassword({
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });

    expect(updateUser).toHaveBeenCalledWith({ password: VALID_PASSWORD });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(result).toEqual({ success: true });
    expect(mocks.loggerInfo).toHaveBeenCalledWith("auth_password_changed", {
      provider: "supabase",
      operation: "change_password",
      outcome: "changed",
    });
    expect(JSON.stringify(mocks.loggerInfo.mock.calls)).not.toContain(
      VALID_PASSWORD,
    );
  });

  it("não devolve o erro do provider", async () => {
    updateUser.mockResolvedValueOnce({
      error: { message: "provider-sensitive-detail" },
    });

    const result = await changePassword({
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });

    expect(result).toEqual({
      success: false,
      error: "password_change_failed",
    });
    expect(JSON.stringify(result)).not.toContain("provider-sensitive-detail");
    expect(signOut).not.toHaveBeenCalled();
  });
});
