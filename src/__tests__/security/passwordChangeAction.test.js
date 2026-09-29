import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { changePassword } from "@/app/[locale]/(auth)/reset/confirm/actions";

describe("changePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser, updateUser: mocks.updateUser },
    });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mocks.updateUser.mockResolvedValue({ error: null });
  });

  it("aplica a política antes de contactar o Supabase", async () => {
    await expect(changePassword("weakpass")).resolves.toEqual({
      error: "password_policy",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("atualiza uma password válida para o utilizador autenticado", async () => {
    await expect(changePassword("Strong!1")).resolves.toEqual({
      success: true,
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "Strong!1" });
  });

  it("devolve um erro genérico sem sessão válida", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(changePassword("Strong!1")).resolves.toEqual({
      error: "password_change_failed",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
