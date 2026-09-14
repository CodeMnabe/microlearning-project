import { getOrganizationFaviconUrl } from "./organizationLogo.helpers";

/**
 * Builds the Next.js metadata overrides for an organization: the browser tab
 * title becomes the organization name and the favicon becomes a square
 * rendition of its uploaded logo. Missing values are omitted so the platform
 * defaults keep applying.
 */
export function getOrganizationMetadata(org) {
  const metadata = {};
  const name = String(org?.name || "").trim();
  const faviconUrl = getOrganizationFaviconUrl(org?.logo_url);

  if (name) {
    metadata.title = name;
  }

  if (faviconUrl) {
    metadata.icons = { icon: faviconUrl };
  }

  return metadata;
}
