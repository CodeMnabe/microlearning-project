import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AutomationsPage from "@/app/[locale]/(app)/automations/page";
import * as AuthContext from "@/app/AuthContext";
import * as useOrganization from "@/app/hooks/useOrganization";
import { GlobalLoaderProvider } from "@/app/LoadingScreen/GlobalLoaderContext";
import { ConfirmProvider } from "@/app/components/Confirm/ConfirmProvider";
import { AlertProvider } from "@/app/components/Alert/AlertProvider";

vi.mock("next-intl", () => ({
  useTranslations: () => (key) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(() => "/"),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Frontend API Contract", () => {
  beforeEach(() => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({
      user: { id: "user-1", organization_id: 999 },
      loading: false,
    });
    vi.spyOn(useOrganization, "default").mockReturnValue({
      org: { id: 999 },
      loading: false,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends exactly { organizationId: orgId } for manual materiality trigger", async () => {
    render(
      <AlertProvider>
        <ConfirmProvider>
          <GlobalLoaderProvider>
            <AutomationsPage />
          </GlobalLoaderProvider>
        </ConfirmProvider>
      </AlertProvider>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/automations/rules?orgId=999");
    });

    const materializeBtn = screen.getByRole("button", { name: "materialize" });
    
    // Clear the initial loads
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ processed: 0 }),
    });

    await userEvent.click(materializeBtn);

    expect(mockFetch).toHaveBeenCalledWith("/api/automations/manual-materialize", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: 999 })
    }));
  });
});
