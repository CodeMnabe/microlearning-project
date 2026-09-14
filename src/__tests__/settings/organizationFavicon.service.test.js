import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const repo = vi.hoisted(() => ({
  downloadOrganizationLogo: vi.fn(),
}));

vi.mock("@/lib/repos/organizationSettings.repo", () => repo);

import {
  FAVICON_SIZE,
  loadOrganizationFavicon,
  renderOrganizationFavicon,
} from "@/lib/services/organizationFavicon.service";

async function wideLogo() {
  return sharp({
    create: {
      width: 200,
      height: 40,
      channels: 4,
      background: { r: 200, g: 30, b: 30, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

describe("organization favicon service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("letterboxes a wide logo into a transparent square", async () => {
    const png = await renderOrganizationFavicon(await wideLogo());
    const { width, height, format } = await sharp(png).metadata();

    expect([format, width, height]).toEqual(["png", FAVICON_SIZE, FAVICON_SIZE]);

    // Corner pixels are transparent padding; the centre row holds the logo.
    const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x, y) => data[(y * FAVICON_SIZE + x) * 4 + 3];
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(32, 32)).toBe(255);
  });

  it("downloads the uploaded logo and renders it", async () => {
    repo.downloadOrganizationLogo.mockResolvedValue(await wideLogo());

    const png = await loadOrganizationFavicon("org-logos/7/logo.png");

    expect(repo.downloadOrganizationLogo).toHaveBeenCalledWith(
      "org-logos/7/logo.png",
    );
    expect((await sharp(png).metadata()).width).toBe(FAVICON_SIZE);
  });

  it("reports a missing logo object as not found", async () => {
    repo.downloadOrganizationLogo.mockResolvedValue(null);

    await expect(
      loadOrganizationFavicon("org-logos/7/gone.png"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("rejects paths outside the logo prefix without touching Storage", async () => {
    await expect(loadOrganizationFavicon("../etc/passwd")).rejects.toMatchObject(
      { status: 400 },
    );
    await expect(loadOrganizationFavicon("")).rejects.toMatchObject({
      status: 400,
    });
    expect(repo.downloadOrganizationLogo).not.toHaveBeenCalled();
  });
});
