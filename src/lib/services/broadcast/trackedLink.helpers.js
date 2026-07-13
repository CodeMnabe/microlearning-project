import crypto from "crypto";

/** Pure normalization helpers for Tracked Links. */

export function normalizeTrackedLinkToken(value) {
  return String(value || "").trim();
}

export function getTrackedLinkClientIp(headers) {
  const forwarded = headers?.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return headers?.get("x-real-ip")?.trim() || "";
}

export function hashTrackedLinkIp(ip = "", salt = "tracked-link-salt") {
  if (!ip) return null;

  const effectiveSalt = salt || "tracked-link-salt";

  return crypto
    .createHash("sha256")
    .update(`${effectiveSalt}:${ip}`)
    .digest("hex");
}
