export class BroadcastError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "BroadcastError";
    this.status = status;
  }
}

export function isImageType(ct = "") {
  return String(ct).toLowerCase().startsWith("image/");
}

export function isVideoType(ct = "") {
  return String(ct).toLowerCase().startsWith("video/");
}

export function guessContentTypeFromUrl(url = "") {
  const u = String(url || "").toLowerCase();

  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".jpg") || u.endsWith(".jpeg")) return "image/jpeg";
  if (u.endsWith("gif")) return "image/gif";
  if (u.endsWith("webp")) return "image/webp";
  if (u.endsWith("pdf")) return "application/pdf";
  if (u.endsWith("mp4")) return "video/mp4";
  if (u.endsWith("mov")) return "video/quicktime";
  if (u.endsWith("webm")) return "video/webm";

  return "application/octet-stream";
}

export function filenameFromUrl(url = "") {
  try {
    const last = String(url).split("?")[0].split("#")[0].split("/").pop();
    return last || "file";
  } catch {
    return "file";
  }
}

export function normalizeFiles({ files = [], imageUrls = [] } = {}) {
  const normalized = [
    ...(Array.isArray(files) ? files : []),
    ...(Array.isArray(imageUrls) ? imageUrls : []).map((url) => ({
      url,
      name: filenameFromUrl(url),
      contentType: guessContentTypeFromUrl(url),
    })),
  ]
    .filter((f) => f?.url)
    .map((f) => ({
      url: f.url,
      name: f.name || filenameFromUrl(f.url),
      contentType: f.contentType || guessContentTypeFromUrl(f.url),
      thumbnailUrl: f.thumbnailUrl || null,
    }));

  const seen = new Set();
  return normalized.filter((f) => {
    if (seen.has(f.url)) return false;
    seen.add(f.url);
    return true;
  });
}
