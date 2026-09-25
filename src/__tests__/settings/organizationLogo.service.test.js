import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  getOrganizationSettings: vi.fn(),
  removeOrganizationLogo: vi.fn(),
  updateOrganizationLogo: vi.fn(),
  uploadOrganizationLogo: vi.fn(),
}));

vi.mock("@/lib/repos/organizationSettings.repo", () => repo);

import {
  buildOrganizationLogoPath,
  DEFAULT_LOGO_URL,
  getOwnedLogoPath,
  MAX_LOGO_SIZE,
  resetOrganizationLogo,
  saveOrganizationLogo,
  sanitizeLogoFilename,
  validateLogoFile,
} from "@/lib/services/organizationLogo.service";

function file(type, size = 10, name = "logo.png") {
  return {
    type,
    size,
    name,
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(size)),
  };
}

describe("organization logo service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.getOrganizationSettings.mockResolvedValue({ logo_url: DEFAULT_LOGO_URL });
    repo.uploadOrganizationLogo.mockResolvedValue("org-logos/7/new.png");
    repo.updateOrganizationLogo.mockResolvedValue({
      id: 7,
      logo_url: "org-logos/7/new.png",
    });
  });

  it.each(["image/png", "image/jpeg", "image/webp"])(
    "accepts %s",
    (type) => expect(() => validateLogoFile(file(type))).not.toThrow(),
  );

  it("rejects SVG, arbitrary MIME types, and files over 2 MB", () => {
    expect(() => validateLogoFile(file("image/svg+xml"))).toThrow(/PNG/);
    expect(() => validateLogoFile(file("application/octet-stream"))).toThrow(
      /PNG/,
    );
    expect(() =>
      validateLogoFile(file("image/png", MAX_LOGO_SIZE + 1)),
    ).toThrow(/2 MB/);
  });

  it("sanitizes unsafe filenames and creates an org-scoped path", () => {
    expect(sanitizeLogoFilename("../../Mínhä Logo<script>.PNG")).toBe(
      "minha-logo-script",
    );
    expect(
      buildOrganizationLogoPath(
        7,
        "../../Mínhä Logo<script>.PNG",
        "image/png",
        "unique",
      ),
    ).toBe("org-logos/7/unique-minha-logo-script.png");
  });

  it("cleans up the new upload when the organization update fails", async () => {
    repo.updateOrganizationLogo.mockRejectedValue(new Error("database failed"));

    await expect(
      saveOrganizationLogo(7, file("image/png", 8, "../unsafe.png")),
    ).rejects.toThrow("database failed");

    const uploadedPath = repo.uploadOrganizationLogo.mock.calls[0][0].path;
    expect(uploadedPath).toMatch(/^org-logos\/7\//);
    expect(uploadedPath).not.toContain("..");
    expect(repo.removeOrganizationLogo).toHaveBeenCalledWith(uploadedPath);
  });

  it("persists the Storage path instead of a public URL", async () => {
    await saveOrganizationLogo(7, file("image/png", 8, "brand.png"));

    expect(repo.updateOrganizationLogo).toHaveBeenCalledWith(
      7,
      "org-logos/7/new.png",
    );
  });

  it("resets to the default and only removes an owned prior object", async () => {
    const owned = "org-logos/7/old.png";
    repo.getOrganizationSettings.mockResolvedValue({ logo_url: owned });
    repo.updateOrganizationLogo.mockResolvedValue({ id: 7, logo_url: DEFAULT_LOGO_URL });

    await expect(resetOrganizationLogo(7)).resolves.toMatchObject({
      logo_url: DEFAULT_LOGO_URL,
    });
    expect(repo.updateOrganizationLogo).toHaveBeenCalledWith(7, DEFAULT_LOGO_URL);
    expect(repo.removeOrganizationLogo).toHaveBeenCalledWith(
      "org-logos/7/old.png",
    );
  });

  it("never treats the default, external, or another org's logo as owned", () => {
    expect(getOwnedLogoPath(DEFAULT_LOGO_URL, 7)).toBeNull();
    expect(getOwnedLogoPath("https://example.com/logo.png", 7)).toBeNull();
    expect(
      getOwnedLogoPath("org-logos/8/logo.png", 7),
    ).toBeNull();
  });

  it("does not delete an external logo while resetting", async () => {
    repo.getOrganizationSettings.mockResolvedValue({
      logo_url: "https://example.com/external-logo.png",
    });
    repo.updateOrganizationLogo.mockResolvedValue({
      id: 7,
      logo_url: DEFAULT_LOGO_URL,
    });

    await resetOrganizationLogo(7);
    expect(repo.removeOrganizationLogo).not.toHaveBeenCalled();
  });
});
