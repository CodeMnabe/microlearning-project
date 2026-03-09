import { vi } from "vitest";

export const appMocks = {
  startLoading: vi.fn(),
  stopLoading: vi.fn(),

  useAuth: vi.fn(),
  useOrganization: vi.fn(),

  confirm: vi.fn(),

  push: vi.fn(),
  replace: vi.fn(),
};

export function registerAppModulePacks() {
  vi.mock("@/app/LoadingScreen/GlobalLoaderContext", () => ({
    useGlobalLoader: () => ({
      startLoading: appMocks.startLoading,
      stopLoading: appMocks.stopLoading,
    }),
  }));

  vi.mock("@/app/AuthContext", () => ({
    useAuth: () => appMocks.useAuth(),
  }));

  vi.mock("@/app/hooks/useOrganization", () => ({
    default: (...args) => appMocks.useOrganization(...args),
  }));

  vi.mock("@/app/components/Confirm/ConfirmProvider", () => ({
    useConfirm: () => appMocks.confirm,
  }));

  vi.mock("next/navigation", () => ({
    useRouter: () => ({
      push: appMocks.push,
      replace: appMocks.replace,
    }),
  }));
}

export function setDefaultAppMockReturns({
  auth = { user: { id: "auth_user_1" }, loading: false, supabase: null },
  org = {
    org: { id: "org_1", default_phone_country_code: "+351" },
    loading: false,
  },
  confirm = true,
} = {}) {
  appMocks.useAuth.mockReturnValue(auth);
  appMocks.useOrganization.mockReturnValue(org);
  appMocks.confirm.mockResolvedValue(confirm);
}

export function resetAppMocks() {
  vi.clearAllMocks();
}
