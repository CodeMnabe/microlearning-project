import sharp from "sharp";
import { getUploadedLogoPath } from "@/lib/helpers/organizationLogo.helpers";
import { downloadOrganizationLogo } from "@/lib/repos/organizationSettings.repo";

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
