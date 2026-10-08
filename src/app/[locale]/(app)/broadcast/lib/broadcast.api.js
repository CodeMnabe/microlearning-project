/* Chamadas HTTP da página de envio. */

export async function fetchTrackedLinkLibrary(orgId) {
  const res = await fetch(
    `/api/tracked-links/library?orgId=${encodeURIComponent(orgId)}`,
    { cache: "no-store" },
  );
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || "Could not load tracked links");
  }

  return Array.isArray(data?.items) ? data.items : [];
}
