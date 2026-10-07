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

/* Pede uma imagem à IA; devolve `{ image, contentType }` (image em base64). */
export async function requestBroadcastImage({ orgId, prompt }) {
  const res = await fetch("/api/broadcast/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId, prompt }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.image) {
    throw new Error(data?.error || "Image generation failed");
  }

  return { image: data.image, contentType: data.contentType || "image/jpeg" };
}
