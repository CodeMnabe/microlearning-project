import "server-only";
import net from "node:net";
import { deriveOpaqueIdentifier } from "./opaqueIdentity";

function normalizeIpCandidate(value) {
  if (typeof value !== "string") return null;
  let candidate = value.trim();
  if (!candidate || candidate.length > 64 || candidate.includes("%")) return null;

  if (candidate.startsWith("[")) {
    const close = candidate.indexOf("]");
    if (close < 0) return null;
    const suffix = candidate.slice(close + 1);
    if (suffix && !/^:\d{1,5}$/.test(suffix)) return null;
    candidate = candidate.slice(1, close);
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d{1,5}$/.test(candidate)) {
    candidate = candidate.slice(0, candidate.lastIndexOf(":"));
  }

  const version = net.isIP(candidate);
  if (!version) return null;
  if (version === 4) return candidate.split(".").map(Number).join(".");
  const hostname = new URL(`http://[${candidate}]/`).hostname;
  return hostname.slice(1, -1).toLowerCase();
}

export function getTrustedClientIp(request) {
  try {
    const mode = String(process.env.TRUSTED_PROXY_MODE || "").trim();
    if (mode === "vercel" && process.env.VERCEL === "1") {
      const forwarded = request.headers.get("x-forwarded-for") || "";
      return normalizeIpCandidate(forwarded.split(",", 1)[0]);
    }
    if (mode === "single") {
      return normalizeIpCandidate(request.headers.get("x-real-ip"));
    }
  } catch {
    return null;
  }
  return null;
}

export function deriveClientIdentity(request, purpose) {
  const normalizedIp = getTrustedClientIp(request);
  return {
    subjectHash: deriveOpaqueIdentifier(purpose, normalizedIp || "unavailable"),
    hasTrustedAddress: Boolean(normalizedIp),
  };
}
