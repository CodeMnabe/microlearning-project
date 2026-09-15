import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { validateLogoFile } from "./organizationLogo.service";
import { getUploadedLogoPath } from "@/lib/helpers/organizationLogo.helpers";
import {
  downloadOrganizationLogo,
  getOrganizationSettings,
  updateOrganizationSettings,
  uploadOrganizationLogo,
  removeOrganizationLogo,
} from "@/lib/repos/organizationSettings.repo";

export const FAVICON_SIZE = 64;

/**
 * Fits the logo inside a transparent square so wide logos are letterboxed
 * instead of being squashed by the browser tab.
 */
export async function renderOrganizationFavicon(bytes) {
  return sharp(bytes)
    .resize(FAVICON_SIZE, FAVICON_SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

function faviconError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function loadOrganizationFavicon(logoPath) {
  const objectPath = getUploadedLogoPath(logoPath);
  if (!objectPath) throw faviconError("Invalid logo path", 400);

  const bytes = await downloadOrganizationLogo(objectPath);
  if (!bytes) throw faviconError("Logo not found", 404);

  return renderOrganizationFavicon(bytes);
}

// Os favicons têm uma pasta própria para nunca remover o logótipo normal.
async function removeOwnedFavicon(path, orgId) {
  if (typeof path !== "string" || !path.startsWith(`org-logos/${orgId}/favicons/`) || path.includes("..")) return;
  try {
    await removeOrganizationLogo(path);
  } catch (error) {
    console.warn("[organization-favicon] Não foi possível limpar o ficheiro", error);
  }
}

export async function saveOrganizationFavicon(orgId, file) {
  try {
    validateLogoFile(file);
  } catch {
    throw faviconError("Escolhe uma imagem PNG, JPEG ou WebP, até 2 MB.", 400);
  }
  let bytes;
  try {
    bytes = await renderOrganizationFavicon(Buffer.from(await file.arrayBuffer()));
  } catch {
    throw faviconError("Não foi possível ler a imagem do favicon.", 400);
  }
  const current = await getOrganizationSettings(orgId);
  const path = `org-logos/${orgId}/favicons/${randomUUID()}.png`;
  let updated;
  try {
    await uploadOrganizationLogo({ path, bytes, contentType: "image/png" });
    updated = await updateOrganizationSettings(orgId, { favicon_url: path });
  } catch (error) {
    await removeOwnedFavicon(path, orgId);
    throw error;
  }
  await removeOwnedFavicon(current?.favicon_url, orgId);
  return updated;
}

export async function resetOrganizationFavicon(orgId) {
  const current = await getOrganizationSettings(orgId);
  const updated = await updateOrganizationSettings(orgId, { favicon_url: null });
  await removeOwnedFavicon(current?.favicon_url, orgId);
  return updated;
}
