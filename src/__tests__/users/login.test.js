import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

import LoginPage from "@/app/[locale]/(auth)/login/page.jsx";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  startLoading: vi.fn(),
  stopLoading: vi.fn(),
  loginAction: vi.fn(),
  auth: {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
  },
}));

vi.mock("@/app/[locale]/(auth)/login/actions", () => ({
  loginAction: (...args) => mocks.loginAction(...args),
}));

vi.mock("@/app/components/TurnstileWidget/TurnstileWidget", () => {
  function MockTurnstile({ onVerify }) {
    React.useEffect(() => {
      onVerify("mock-token");
    }, [onVerify]);
    return null;
  }

  return { default: MockTurnstile };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
  }),
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
  }),
  redirect: vi.fn(),
  usePathname: vi.fn(),
  Link: ({ href, children, ...rest }) =>
    React.createElement("a", { href, ...rest }, children),
}));

// No JSX here either
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) =>
    React.createElement("a", { href, ...rest }, children),
}));

vi.mock("@/app/LoadingScreen/GlobalLoaderContext", () => ({
  useGlobalLoader: () => ({
    startLoading: mocks.startLoading,
    stopLoading: mocks.stopLoading,
  }),
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: mocks.auth,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.getSession.mockResolvedValue({ data: { session: null } });
});

describe("LoginPage", () => {
  it("redirects to /pt/users if session exists", async () => {
    mocks.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "123" } } },
    });

    render(React.createElement(LoginPage));

    await waitFor(() => {
      expect(mocks.startLoading).toHaveBeenCalled();
      expect(mocks.replace).toHaveBeenCalledWith("/pt/users");
    });

    expect(mocks.stopLoading).not.toHaveBeenCalled();
  });

  it("stops loading if no session", async () => {
    mocks.auth.getSession.mockResolvedValue({
      data: { session: null },
    });

    render(React.createElement(LoginPage));

    await waitFor(() => {
      expect(mocks.stopLoading).toHaveBeenCalled();
    });

    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("shows error message when login fails", async () => {
    mocks.auth.getSession.mockResolvedValue({ data: { session: null } });
    mocks.loginAction.mockResolvedValueOnce({
      error: "auth_invalid_credentials",
    });

    const user = userEvent.setup();
    render(React.createElement(LoginPage));

    await user.type(screen.getByLabelText("Auth.login.email"), "a@a.com");
    await user.type(screen.getByLabelText("Auth.login.password"), "wrongpass");

    await user.click(screen.getByRole("button", { name: "Auth.login.login" }));

    expect(
      await screen.findByText("Auth.login.invalidCredentials"),
    ).toBeInTheDocument();

    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("navigates to /pt/users on login success after 650ms", async () => {
    const realSetTimeout = globalThis.setTimeout;

    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation((cb, ms, ...args) => {
        if (ms === 650) {
          cb(...args);
          return 0;
        }

        return realSetTimeout(cb, ms, ...args);
      });

    mocks.loginAction.mockResolvedValueOnce({ success: true });

    const user = userEvent.setup();
    render(React.createElement(LoginPage));

    await user.type(screen.getByLabelText("Auth.login.email"), "a@a.com");
    await user.type(
      screen.getByLabelText("Auth.login.password"),
      "correctpass",
    );

    await user.click(screen.getByRole("button", { name: "Auth.login.login" }));

    expect(await screen.findByLabelText("Common.ok")).toBeInTheDocument();

    expect(mocks.startLoading).toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith("/pt/users");

    timeoutSpy.mockRestore();
  });
});
