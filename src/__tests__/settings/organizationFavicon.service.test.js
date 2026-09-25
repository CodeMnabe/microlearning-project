import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const repo = vi.hoisted(() => ({
  downloadOrganizationLogo: vi.fn(),
  getOrganizationSettings: vi.fn(),
  updateOrganizationSettings: vi.fn(),
  uploadOrganizationLogo: vi.fn(),
  removeOrganizationLogo: vi.fn(),
}));

vi.mock("@/lib/repos/organizationSettings.repo", () => repo);

import {
  FAVICON_SIZE,
  saveOrganizationFavicon,
  resetOrganizationFavicon,
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

async function faviconFile() {
  const bytes = await wideLogo();
  return { name: "icon.png", type: "image/png", size: bytes.length, arrayBuffer: async () => bytes };
}

describe("upload independente do favicon", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repo.getOrganizationSettings.mockResolvedValue({ logo_url: "org-logos/7/logo.png", favicon_url: "org-logos/7/favicons/old.png" });
  });

  it("guarda só favicon_url e limpa apenas o favicon anterior", async () => {
    await saveOrganizationFavicon(7, await faviconFile());
    expect(repo.updateOrganizationSettings).toHaveBeenCalledWith(7, { favicon_url: expect.stringMatching(/^org-logos\/7\/favicons\/.+\.png$/) });
    expect(repo.removeOrganizationLogo).toHaveBeenCalledExactlyOnceWith("org-logos/7/favicons/old.png");
    const upload = repo.uploadOrganizationLogo.mock.calls[0][0];
    expect((await sharp(upload.bytes).metadata()).width).toBe(64);
  });

  it("remove o favicon e repõe a configuração por omissão", async () => {
    await resetOrganizationFavicon(7);
    expect(repo.updateOrganizationSettings).toHaveBeenCalledWith(7, { favicon_url: null });
    expect(repo.removeOrganizationLogo).toHaveBeenCalledExactlyOnceWith("org-logos/7/favicons/old.png");
  });

  it("nunca apaga o logótipo nem ficheiros de outra organização", async () => {
    for (const path of ["org-logos/7/logo.png", "org-logos/8/favicons/icon.png"]) {
      repo.getOrganizationSettings.mockResolvedValue({ favicon_url: path });
      await resetOrganizationFavicon(7);
    }
    expect(repo.removeOrganizationLogo).not.toHaveBeenCalled();
  });

  it("limpa o novo upload se a gravação falhar, preservando o anterior", async () => {
    repo.updateOrganizationSettings.mockRejectedValue(new Error("Falha de ligação"));
    await expect(saveOrganizationFavicon(7, await faviconFile())).rejects.toThrow("Falha de ligação");
    expect(repo.removeOrganizationLogo).toHaveBeenCalledExactlyOnceWith(repo.uploadOrganizationLogo.mock.calls[0][0].path);
  });

  it("rejeita conteúdo inválido antes de aceder ao armazenamento", async () => {
    const file = { name: "icon.png", type: "image/png", size: 3, arrayBuffer: async () => Buffer.from("bad") };
    await expect(saveOrganizationFavicon(7, file)).rejects.toMatchObject({ status: 400 });
    await expect(saveOrganizationFavicon(7, { ...file, size: 3 * 1024 * 1024 })).rejects.toMatchObject({ status: 400 });
    await expect(saveOrganizationFavicon(7, { ...file, type: "image/svg+xml" })).rejects.toMatchObject({ status: 400 });
    expect(repo.uploadOrganizationLogo).not.toHaveBeenCalled();
  });
});
