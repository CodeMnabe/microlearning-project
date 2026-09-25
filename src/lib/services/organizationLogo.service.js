import { randomUUID } from "node:crypto";
import { DEFAULT_LOGO_URL } from "@/lib/helpers/organizationLogo.helpers";
import {
  getOrganizationSettings,
  removeOrganizationLogo,
  updateOrganizationLogo,
  uploadOrganizationLogo,
} from "@/lib/repos/organizationSettings.repo";

export { DEFAULT_LOGO_URL };
export const MAX_LOGO_SIZE = 2 * 1024 * 1024;

const LOGO_EXTENSIONS = Object.freeze({
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
});

function logoError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function sanitizeLogoFilename(filename) {
  const base = String(filename || "logo")
    .replace(/\.[^.]*$/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return base || "logo";
}

export function buildOrganizationLogoPath(
  orgId,
  filename,
  contentType,
  uniqueId = randomUUID(),
) {
  const extension = LOGO_EXTENSIONS[contentType];
  if (!extension) throw logoError("Unsupported logo format");

  const safeName = sanitizeLogoFilename(filename);
  return `org-logos/${orgId}/${uniqueId}-${safeName}.${extension}`;
}

export function getOwnedLogoPath(logoPath, orgId) {
  if (typeof logoPath !== "string" || !logoPath.trim()) return null;

  const ownedPrefix = `org-logos/${orgId}/`;
  const objectPath = logoPath.trim().replace(/^\/+/, "").split(/[?#]/, 1)[0];

  if (!objectPath.startsWith(ownedPrefix)) return null;
  if (objectPath.includes("..")) return null;

  return objectPath;
}

export function validateLogoFile(file) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw logoError("A logo file is required");
  }

  if (!LOGO_EXTENSIONS[file.type]) {
    throw logoError("Logo must be a PNG, JPEG, or WebP image");
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw logoError("Logo file is empty");
  }

  if (file.size > MAX_LOGO_SIZE) {
    throw logoError("Logo must not exceed 2 MB");
  }
}

async function removeOwnedLogoBestEffort(logoPath, orgId) {
  const path = getOwnedLogoPath(logoPath, orgId);
  if (!path) return;

  try {
    await removeOrganizationLogo(path);
  } catch (error) {
    console.warn("[organization-logo] cleanup failed", error);
  }
}

export async function saveOrganizationLogo(orgId, file) {
  validateLogoFile(file);

  const current = await getOrganizationSettings(orgId);
  const path = buildOrganizationLogoPath(orgId, file.name, file.type);
  const bytes = Buffer.from(await file.arrayBuffer());
  let savedLogoPath;
  let updated;
  try {
    savedLogoPath = await uploadOrganizationLogo({
      path,
      bytes,
      contentType: file.type,
    });
    updated = await updateOrganizationLogo(orgId, savedLogoPath);
  } catch (error) {
    await removeOwnedLogoBestEffort(path, orgId);
    throw error;
  }

  if (current?.logo_url !== savedLogoPath) {
    await removeOwnedLogoBestEffort(current?.logo_url, orgId);
  }

  return updated;
}

export async function resetOrganizationLogo(orgId) {
  const current = await getOrganizationSettings(orgId);
  const updated = await updateOrganizationLogo(orgId, DEFAULT_LOGO_URL);

  await removeOwnedLogoBestEffort(current?.logo_url, orgId);
  return updated;
}
