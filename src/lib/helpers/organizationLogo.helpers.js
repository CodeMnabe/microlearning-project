export const DEFAULT_LOGO_URL = "/images/Logos/Logo cores.png";
export const LOGO_STORAGE_BUCKET = "images";
export const LOGO_STORAGE_PREFIX = "org-logos/";
export const FAVICON_ROUTE = "/api/organizations/favicon";

/**
 * Returns the Storage object path of an uploaded organization logo, or null
 * for the platform default, external URLs and anything outside the logo prefix.
 */
export function getUploadedLogoPath(logoPathOrUrl) {
  const objectPath = String(logoPathOrUrl || "")
    .trim()
    .replace(/^\/+/, "")
    .split(/[?#]/, 1)[0];

  if (!objectPath.startsWith(LOGO_STORAGE_PREFIX)) return null;
  if (objectPath.split("/").includes("..")) return null;

  return objectPath;
}

/**
 * URL of the square favicon rendered from an uploaded logo, or null when the
 * organization uses the platform default (the site favicon applies then).
 */
export function getOrganizationFaviconUrl(logoPathOrUrl) {
  const objectPath = getUploadedLogoPath(logoPathOrUrl);
  if (!objectPath) return null;

  return `${FAVICON_ROUTE}?path=${encodeURIComponent(objectPath)}`;
}

export function getOrganizationLogoUrl(logoPathOrUrl) {
  const normalizedPath = String(logoPathOrUrl || "").trim();

  if (!normalizedPath) {
    return DEFAULT_LOGO_URL;
  }

  if (
    /^https?:\/\//i.test(normalizedPath) ||
    !normalizedPath.startsWith(LOGO_STORAGE_PREFIX)
  ) {
    return normalizedPath;
  }

  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "");

  if (!supabaseUrl) {
    return DEFAULT_LOGO_URL;
  }

  const encodedPath = normalizedPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${supabaseUrl}/storage/v1/object/public/${LOGO_STORAGE_BUCKET}/${encodedPath}`;
}
