import { getOrganizationFaviconUrl } from "./organizationLogo.helpers";

// Identidade do separador: nome e favicon independente do logótipo.
export function getOrganizationMetadata(org) {
  const metadata = {};
  const name = String(org?.name || "").trim();
  const faviconUrl = getOrganizationFaviconUrl(org?.favicon_url);

  if (name) {
    metadata.title = name;
  }

  if (faviconUrl) {
    metadata.icons = { icon: faviconUrl };
  }

  return metadata;
}
