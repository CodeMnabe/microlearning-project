import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LOGO_URL,
  getOrganizationLogoUrl,
} from "@/lib/helpers/organizationLogo.helpers";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("organization logo URL resolution", () => {
  it("uses the platform default when no path is stored", () => {
    expect(getOrganizationLogoUrl()).toBe(DEFAULT_LOGO_URL);
  });

  it("keeps local public asset paths unchanged", () => {
    expect(getOrganizationLogoUrl(DEFAULT_LOGO_URL)).toBe(DEFAULT_LOGO_URL);
  });

  it("keeps an already-resolved URL unchanged", () => {
    const publicUrl =
      "https://project.supabase.co/storage/v1/object/public/images/org-logos/7/new.png";

    expect(getOrganizationLogoUrl(publicUrl)).toBe(publicUrl);
  });

  it("builds the public Storage URL from an organization logo path", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co/");

    expect(getOrganizationLogoUrl("org-logos/7/new logo.png")).toBe(
      "https://project.supabase.co/storage/v1/object/public/images/org-logos/7/new%20logo.png",
    );
  });
});
