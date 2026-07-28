import "server-only";

export function getSafeRedirectPath(input, defaultPath = "/") {
  if (typeof input !== "string") return defaultPath;

  let path = input.split("?")[0].split("#")[0];
  if (path.length > 256) return defaultPath;

  let decoded;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return defaultPath;
  }

  const checks = [path, decoded];
  for (const p of checks) {
    if (!p.startsWith("/")) return defaultPath;
    if (p.startsWith("//") || p.startsWith("/\\") || p.startsWith("\\"))
      return defaultPath;
    if (/[\x00-\x1F\x7F]/.test(p)) return defaultPath;

    const lower = p.toLowerCase();
    if (
      lower.startsWith("javascript:") ||
      lower.startsWith("data:") ||
      lower.startsWith("vbscript:")
    )
      return defaultPath;
    if (lower.startsWith("/%2f")) return defaultPath;
  }

  return path;
}

export function getSiteOrigin() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (!siteUrl && process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }
  if (!siteUrl) {
    throw new Error("NEXT_PUBLIC_SITE_URL is not set");
  }

  let origin;
  try {
    const url = new URL(siteUrl);
    origin = url.origin;
    if (
      process.env.NODE_ENV === "production" &&
      url.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname)
    ) {
      throw new Error("Site origin must be HTTPS in production");
    }
    if (url.username || url.password) {
      throw new Error("Site origin must not contain credentials");
    }
  } catch (e) {
    throw e;
  }

  return origin;
}

export function getAuthCallbackUrl(nextPath) {
  const origin = getSiteOrigin();
  const base = `${origin}/api/auth/callback`;
  if (nextPath) {
    const safePath = getSafeRedirectPath(nextPath, null);
    if (safePath) {
      return `${base}?next=${encodeURIComponent(safePath)}`;
    }
  }
  return base;
}
