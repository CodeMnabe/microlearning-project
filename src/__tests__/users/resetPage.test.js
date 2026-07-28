import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ResetRequestPage from "@/app/[locale]/(auth)/reset/page";

const mockTurnstileReset = vi.fn();

const mocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/app/[locale]/(auth)/reset/actions", () => ({
  requestPasswordReset: (...args) => mocks.requestPasswordReset(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "pt",
  useTranslations: () => (key) => key,
}));

vi.mock("@/app/components/TurnstileWidget/TurnstileWidget", () => {
  const MockTurnstile = React.forwardRef(function MockTurnstile(
    { onVerify },
    ref,
  ) {
    React.useImperativeHandle(ref, () => ({
      reset: mockTurnstileReset,
    }));
    React.useEffect(() => {
      if (onVerify) {
        onVerify("mock-captcha-token");
      }
    }, [onVerify]);
    return <div data-testid="turnstile" />;
  });

  return {
    default: MockTurnstile,
  };
});

describe("ResetRequestPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não cria Supabase browser client e chama Server Action", async () => {
    mocks.requestPasswordReset.mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    render(<ResetRequestPage />);

    const emailInput = screen.getByRole("textbox");
    await user.type(emailInput, "test@example.com");

    const submitBtn = screen.getByRole("button", { name: "Auth.reset.send" });
    await user.click(submitBtn);

    expect(mocks.requestPasswordReset).toHaveBeenCalledWith({
      email: "test@example.com",
      captchaToken: "mock-captcha-token",
      locale: "pt",
    });

    await waitFor(() => expect(mockTurnstileReset).toHaveBeenCalled());
  });

  it("resets turnstile on failure and shows generic response", async () => {
    mocks.requestPasswordReset.mockResolvedValueOnce({ error: "some_error" });
    const user = userEvent.setup();
    render(<ResetRequestPage />);

    const emailInput = screen.getByRole("textbox");
    await user.type(emailInput, "test@example.com");

    const submitBtn = screen.getByRole("button", { name: "Auth.reset.send" });
    await user.click(submitBtn);

    await waitFor(() => expect(mockTurnstileReset).toHaveBeenCalled());
    expect(
      await screen.findByText("Auth.reset.genericError"),
    ).toBeInTheDocument();
  });

  it("handles 429 and Retry-After", async () => {
    mocks.requestPasswordReset.mockResolvedValueOnce({
      error: "auth_rate_limited",
      retryAfter: 60,
    });
    const user = userEvent.setup();
    render(<ResetRequestPage />);

    const emailInput = screen.getByRole("textbox");
    await user.type(emailInput, "test@example.com");

    const submitBtn = screen.getByRole("button", { name: "Auth.reset.send" });
    await user.click(submitBtn);

    expect(await screen.findByText("Auth.rateLimited")).toBeInTheDocument();
  });

  it("blocks double-click", async () => {
    let resolveAction;
    const actionPromise = new Promise((resolve) => {
      resolveAction = resolve;
    });
    mocks.requestPasswordReset.mockReturnValueOnce(actionPromise);

    const user = userEvent.setup();
    render(<ResetRequestPage />);

    const emailInput = screen.getByRole("textbox");
    await user.type(emailInput, "test@example.com");

    const submitBtn = screen.getByRole("button", { name: "Auth.reset.send" });
    await user.click(submitBtn);
    await user.click(submitBtn);

    expect(mocks.requestPasswordReset).toHaveBeenCalledTimes(1);

    resolveAction({ success: true });
  });
});
