import React from "react";
import fs from "node:fs";
import path from "node:path";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetConfirmPage from "@/app/[locale]/(auth)/reset/confirm/page";

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/app/[locale]/(auth)/reset/confirm/actions", () => ({
  changePassword: mocks.changePassword,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "pt",
  useTranslations: () => (key) => key,
}));

const VALID_PASSWORD = "Str0ng!Password";

describe("ResetConfirmPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("apresenta dois campos com mínimo 12 e requisitos", () => {
    render(<ResetConfirmPage />);

    const password = screen.getByLabelText("Auth.resetConfirm.newPassword");
    const confirmation = screen.getByLabelText(
      "Auth.resetConfirm.confirmPassword",
    );

    expect(password).toHaveAttribute("minLength", "12");
    expect(confirmation).toHaveAttribute("minLength", "12");
    expect(
      screen.getByText("Auth.resetConfirm.requirements"),
    ).toBeInTheDocument();
  });

  it("não contém acesso Auth nem updateUser no browser", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/app/[locale]/(auth)/reset/confirm/page.js"),
      "utf8",
    );

    expect(source).not.toContain("updateUser");
    expect(source).not.toContain("createClient");
    expect(source).not.toContain(".auth.");
  });

  it("chama exclusivamente a Server Action com os dois campos", async () => {
    mocks.changePassword.mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    render(<ResetConfirmPage />);

    await user.type(
      screen.getByLabelText("Auth.resetConfirm.newPassword"),
      VALID_PASSWORD,
    );
    await user.type(
      screen.getByLabelText("Auth.resetConfirm.confirmPassword"),
      VALID_PASSWORD,
    );
    await user.click(
      screen.getByRole("button", { name: "Auth.resetConfirm.confirm" }),
    );

    expect(mocks.changePassword).toHaveBeenCalledWith({
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });
    expect(mocks.replace).toHaveBeenCalledWith("/pt/login");
  });

  it("bloqueia double-submit", async () => {
    let resolveAction;
    mocks.changePassword.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<ResetConfirmPage />);

    await user.type(
      screen.getByLabelText("Auth.resetConfirm.newPassword"),
      VALID_PASSWORD,
    );
    await user.type(
      screen.getByLabelText("Auth.resetConfirm.confirmPassword"),
      VALID_PASSWORD,
    );
    const button = screen.getByRole("button", {
      name: "Auth.resetConfirm.confirm",
    });

    await user.click(button);
    await user.click(button);
    expect(mocks.changePassword).toHaveBeenCalledOnce();

    await act(async () => {
      resolveAction({ success: true });
    });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
  });

  it("mostra apenas erro genérico e limpa os campos", async () => {
    mocks.changePassword.mockResolvedValueOnce({
      success: false,
      error: "password_change_failed",
    });
    const user = userEvent.setup();
    render(<ResetConfirmPage />);

    const password = screen.getByLabelText("Auth.resetConfirm.newPassword");
    const confirmation = screen.getByLabelText(
      "Auth.resetConfirm.confirmPassword",
    );
    await user.type(password, VALID_PASSWORD);
    await user.type(confirmation, "Different1!Password");
    await user.click(
      screen.getByRole("button", { name: "Auth.resetConfirm.confirm" }),
    );

    expect(
      await screen.findByText("Auth.resetConfirm.genericError"),
    ).toBeInTheDocument();
    expect(password).toHaveValue("");
    expect(confirmation).toHaveValue("");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("mantém o botão indisponível enquanto a ação está pendente", async () => {
    let resolveAction;
    mocks.changePassword.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<ResetConfirmPage />);

    await user.type(
      screen.getByLabelText("Auth.resetConfirm.newPassword"),
      VALID_PASSWORD,
    );
    await user.type(
      screen.getByLabelText("Auth.resetConfirm.confirmPassword"),
      VALID_PASSWORD,
    );
    const button = screen.getByRole("button", {
      name: "Auth.resetConfirm.confirm",
    });
    await user.click(button);

    expect(button).toBeDisabled();
    await act(async () => {
      resolveAction({ success: true });
    });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
  });
});
