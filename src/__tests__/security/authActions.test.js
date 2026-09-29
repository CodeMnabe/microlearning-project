import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeAuthAttempt: vi.fn(),
  createClient: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("@/lib/auth/authRateLimit", () => ({
  consumeAuthAttempt: mocks.consumeAuthAttempt,
}));
vi.mock("@/utils/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "https://app.example.com" }),
}));

import { login } from "@/app/[locale]/(auth)/login/actions";
import { requestPasswordReset } from "@/app/[locale]/(auth)/reset/actions";

describe("limited auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeAuthAttempt.mockResolvedValue(true);
    mocks.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: mocks.signInWithPassword,
        resetPasswordForEmail: mocks.resetPasswordForEmail,
      },
    });
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it("bloqueia o login sem chamar o fornecedor", async () => {
    mocks.consumeAuthAttempt.mockResolvedValueOnce(false);
    await expect(
      login({ email: "owner@example.com", password: "secret" }),
    ).resolves.toEqual({ error: "auth_failed" });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("usa o mesmo erro genérico quando as credenciais falham", async () => {
    mocks.signInWithPassword.mockResolvedValueOnce({
      error: new Error("invalid credentials"),
    });
    await expect(
      login({ email: "owner@example.com", password: "wrong" }),
    ).resolves.toEqual({ error: "auth_failed" });
  });

  it("não aplica a nova política a passwords existentes no login", async () => {
    await expect(
      login({ email: "owner@example.com", password: "legacy" }),
    ).resolves.toEqual({ success: true });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "legacy",
    });
  });

  it("responde sempre da mesma forma ao pedido de reset bloqueado", async () => {
    mocks.consumeAuthAttempt.mockResolvedValueOnce(false);
    await expect(
      requestPasswordReset({
        email: "missing@example.com",
        locale: "pt",
        next: "/users",
      }),
    ).resolves.toEqual({ success: true });
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("constrói o link de reset com a origem do pedido e o idioma", async () => {
    await requestPasswordReset({ email: "owner@example.com", locale: "en" });
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "owner@example.com",
      expect.objectContaining({
        redirectTo:
          "https://app.example.com/en/reset/confirm?next=%2Fen%2Fusers",
      }),
    );
  });
});
