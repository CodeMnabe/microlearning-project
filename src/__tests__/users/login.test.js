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
  auth: {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
  }),
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
    mocks.auth.getSession.mockResolvedValueOnce({
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
    mocks.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
    });

    render(React.createElement(LoginPage));

    await waitFor(() => {
      expect(mocks.stopLoading).toHaveBeenCalled();
    });

    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("shows error message when login fails", async () => {
    mocks.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    mocks.auth.signInWithPassword.mockResolvedValueOnce({
      error: { message: "Invalid login credentials" },
    });

    const user = userEvent.setup();
    render(React.createElement(LoginPage));

    await user.type(screen.getByLabelText("Auth.login.email"), "a@a.com");
    await user.type(screen.getByLabelText("Auth.login.password"), "wrongpass");

    await user.click(screen.getByRole("button", { name: "Auth.login.login" }));

    expect(
      await screen.findByText("Invalid login credentials"),
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

    mocks.auth.signInWithPassword.mockResolvedValueOnce({ error: null });

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
