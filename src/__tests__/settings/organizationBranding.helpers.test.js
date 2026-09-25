import { describe, expect, it } from "vitest";
import { getOrganizationMetadata } from "@/lib/helpers/organizationBranding.helpers";
import {
  DEFAULT_LOGO_URL,
  getOrganizationFaviconUrl,
  getUploadedLogoPath,
} from "@/lib/helpers/organizationLogo.helpers";

describe("uploaded logo path detection", () => {
  it("returns null for the platform default, empty values and external URLs", () => {
    expect(getUploadedLogoPath(DEFAULT_LOGO_URL)).toBeNull();
    expect(getUploadedLogoPath("")).toBeNull();
    expect(getUploadedLogoPath(null)).toBeNull();
    expect(getUploadedLogoPath("https://cdn.example.com/logo.png")).toBeNull();
  });

  it("returns the Storage object path for uploaded logos", () => {
    expect(getUploadedLogoPath("org-logos/7/abc-logo.png")).toBe(
      "org-logos/7/abc-logo.png",
    );
    expect(getUploadedLogoPath("/org-logos/7/abc-logo.png?x=1")).toBe(
      "org-logos/7/abc-logo.png",
    );
  });

  it("rejects path traversal", () => {
    expect(getUploadedLogoPath("org-logos/../secret.png")).toBeNull();
  });
});

describe("organization favicon URL", () => {
  it("points at the favicon route for uploaded logos only", () => {
    expect(getOrganizationFaviconUrl("org-logos/7/abc logo.png")).toBe(
      "/api/organizations/favicon?path=org-logos%2F7%2Fabc%20logo.png",
    );
    expect(getOrganizationFaviconUrl(DEFAULT_LOGO_URL)).toBeNull();
  });
});

describe("organization branding metadata", () => {
  it("keeps platform defaults when the organization has no name or custom logo", () => {
    expect(getOrganizationMetadata(null)).toEqual({});
    expect(getOrganizationMetadata({ name: "  ", logo_url: "" })).toEqual({});
    expect(
      getOrganizationMetadata({ name: "", logo_url: DEFAULT_LOGO_URL }),
    ).toEqual({});
  });

  it("uses the organization name as the tab title", () => {
    expect(getOrganizationMetadata({ name: " Acme ", logo_url: null })).toEqual(
      { title: "Acme" },
    );
  });

  it("uses the separately uploaded favicon", () => {
    expect(
      getOrganizationMetadata({ name: "Acme", favicon_url: "org-logos/7/logo.png" }),
    ).toEqual({
      title: "Acme",
      icons: { icon: "/api/organizations/favicon?path=org-logos%2F7%2Flogo.png" },
    });
  });
});

it("não usa o logótipo como favicon quando não existe favicon personalizado", () => {
  expect(getOrganizationMetadata({ name: "Acme", logo_url: "org-logos/7/logo.png", favicon_url: null })).toEqual({ title: "Acme" });
});
