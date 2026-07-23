import "server-only";
import crypto from "node:crypto";
import { getAbuseIdentitySecret } from "@/lib/security/opaqueIdentity";
import { TRACKED_LINK_CONTEXT_TTL_SECONDS } from "@/lib/limits/publicAbuse";

const CONTEXT_VERSION = 1;
const CONTEXT_PURPOSE = "tracked-link-interaction";
const CONTEXT_PURPOSE_ID = 1;
const CONTEXT_AAD = Buffer.from(
  `mydigitalbot:${CONTEXT_PURPOSE}:v${CONTEXT_VERSION}`,
  "utf8",
);
const CONTEXT_IV_BYTES = 12;
const CONTEXT_TAG_BYTES = 16;
const CONTEXT_HEADER_BYTES = 2;
const CONTEXT_MAX_ENCODED_BYTES = 1024;
const CONTEXT_MAX_PAYLOAD_BYTES = 512;
const CLIENT_CLASSES = new Set(["browser", "preview", "scanner", "unknown"]);
const PREVIEW_HEADERS = [
  "x-purpose",
  "purpose",
  "x-moz",
  "x-pinterest-rid",
  "x-slack-no-retry",
];
const PREVIEW_AGENT = /(facebookexternalhit|facebot|linkedinbot|slackbot|discordbot|telegrambot|twitterbot|whatsapp|skypeuripreview|google-web-preview)/i;
const SCANNER_AGENT = /(urlscan|security|safelinks|proofpoint|barracuda|mimecast|spider|crawler|scanner|bot\b|headless)/i;

function deriveContextEncryptionKey() {
  return crypto
    .createHmac("sha256", getAbuseIdentitySecret())
    .update(`mydigitalbot:${CONTEXT_PURPOSE}:encryption-key:v1`, "utf8")
    .digest();
}

function isHash(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

export function classifyTrackedLinkClient(request) {
  try {
    if (request.method === "HEAD") return "preview";
    if (PREVIEW_HEADERS.some((header) => request.headers.has(header))) {
      return "preview";
    }
    const userAgent = request.headers.get("user-agent") || "";
    if (!userAgent) return "unknown";
    if (PREVIEW_AGENT.test(userAgent)) return "preview";
    if (SCANNER_AGENT.test(userAgent)) return "scanner";
    if (/mozilla\//i.test(userAgent)) return "browser";
  } catch {
    return "unknown";
  }
  return "unknown";
}

export function normalizeAllowedRefererOrigin(request) {
  try {
    const allowed = String(process.env.TRACKED_LINK_REFERER_ORIGINS || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length === 0) return null;
    const raw = request.headers.get("referer");
    if (!raw || raw.length > 2048) return null;
    const origin = new URL(raw).origin.toLowerCase();
    return allowed.includes(origin) ? origin : null;
  } catch {
    return null;
  }
}

export function createTrackedLinkContext({
  trackedLinkId,
  visitorHash,
  tokenHash,
  recipientUserId,
  clientClassification,
  now = Date.now(),
}) {
  if (
    typeof trackedLinkId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(trackedLinkId) ||
    !isHash(visitorHash) ||
    !isHash(tokenHash) ||
    !CLIENT_CLASSES.has(clientClassification) ||
    (recipientUserId !== null &&
      recipientUserId !== undefined &&
      !Number.isSafeInteger(recipientUserId))
  ) {
    throw new TypeError("Tracked-link client classification is invalid");
  }
  const payload = JSON.stringify({
    v: CONTEXT_VERSION,
    l: trackedLinkId,
    h: visitorHash,
    t: tokenHash,
    r: recipientUserId ?? null,
    c: clientClassification,
    e: Math.floor(now / 1000) + TRACKED_LINK_CONTEXT_TTL_SECONDS,
  });
  if (Buffer.byteLength(payload, "utf8") > CONTEXT_MAX_PAYLOAD_BYTES) {
    throw new TypeError("Tracked-link interaction context is too large");
  }
  const iv = crypto.randomBytes(CONTEXT_IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveContextEncryptionKey(), iv);
  cipher.setAAD(CONTEXT_AAD);
  const ciphertext = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  return Buffer.concat([
    Buffer.from([CONTEXT_VERSION, CONTEXT_PURPOSE_ID]),
    iv,
    cipher.getAuthTag(),
    ciphertext,
  ]).toString("base64url");
}

export function verifyTrackedLinkContext(value, { now = Date.now() } = {}) {
  try {
    if (
      typeof value !== "string" ||
      value.length < 48 ||
      value.length > CONTEXT_MAX_ENCODED_BYTES
    ) {
      return null;
    }
    const encoded = Buffer.from(value, "base64url");
    if (
      encoded.length < CONTEXT_HEADER_BYTES + CONTEXT_IV_BYTES + CONTEXT_TAG_BYTES + 1 ||
      encoded.length > CONTEXT_MAX_PAYLOAD_BYTES + CONTEXT_HEADER_BYTES + CONTEXT_IV_BYTES + CONTEXT_TAG_BYTES
    ) {
      return null;
    }
    if (
      encoded[0] !== CONTEXT_VERSION ||
      encoded[1] !== CONTEXT_PURPOSE_ID
    ) {
      return null;
    }
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      deriveContextEncryptionKey(),
      encoded.subarray(CONTEXT_HEADER_BYTES, CONTEXT_HEADER_BYTES + CONTEXT_IV_BYTES),
    );
    decipher.setAAD(CONTEXT_AAD);
    decipher.setAuthTag(
      encoded.subarray(
        CONTEXT_HEADER_BYTES + CONTEXT_IV_BYTES,
        CONTEXT_HEADER_BYTES + CONTEXT_IV_BYTES + CONTEXT_TAG_BYTES,
      ),
    );
    const plain = Buffer.concat([
      decipher.update(encoded.subarray(CONTEXT_HEADER_BYTES + CONTEXT_IV_BYTES + CONTEXT_TAG_BYTES)),
      decipher.final(),
    ]).toString("utf8");
    if (Buffer.byteLength(plain, "utf8") > CONTEXT_MAX_PAYLOAD_BYTES) return null;
    const parsed = JSON.parse(plain);
    if (
      parsed?.v !== CONTEXT_VERSION ||
      typeof parsed?.l !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(parsed.l) ||
      typeof parsed?.h !== "string" ||
      !/^[0-9a-f]{64}$/.test(parsed.h) ||
      typeof parsed?.t !== "string" ||
      !/^[0-9a-f]{64}$/.test(parsed.t) ||
      !CLIENT_CLASSES.has(parsed?.c) ||
      !Number.isSafeInteger(parsed?.e) ||
      parsed.e < Math.floor(now / 1000)
    ) {
      return null;
    }
    return {
      trackedLinkId: parsed.l,
      visitorHash: parsed.h,
      tokenHash: parsed.t,
      recipientUserId: Number.isSafeInteger(parsed.r) ? parsed.r : null,
      clientClassification: parsed.c,
      expiresAt: parsed.e,
    };
  } catch {
    return null;
  }
}
