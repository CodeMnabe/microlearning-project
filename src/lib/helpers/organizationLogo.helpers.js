export const DEFAULT_LOGO_URL = "/images/Logos/Logo cores.png";
export const LOGO_STORAGE_BUCKET = "images";
export const LOGO_STORAGE_PREFIX = "org-logos/";

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
