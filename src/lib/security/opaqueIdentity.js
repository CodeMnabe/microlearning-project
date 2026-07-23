import "server-only";
import crypto from "node:crypto";

const PURPOSE_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const MINIMUM_SECRET_BYTES = 32;

export function getAbuseIdentitySecret() {
  const secret = process.env.ABUSE_IDENTITY_SECRET;
  if (
    typeof secret !== "string" ||
    secret.trim() !== secret ||
    Buffer.byteLength(secret, "utf8") < MINIMUM_SECRET_BYTES
  ) {
    throw new Error("ABUSE_IDENTITY_SECRET is missing or too short");
  }
  return secret;
}

export function deriveOpaqueIdentifier(purpose, input) {
  if (!PURPOSE_PATTERN.test(String(purpose || ""))) {
    throw new TypeError("Opaque identity purpose is invalid");
  }
  if (typeof input !== "string" || input.length === 0) {
    throw new TypeError("Opaque identity input is invalid");
  }

  return crypto
    .createHmac("sha256", getAbuseIdentitySecret())
    .update(`mydigitalbot:${purpose}\0`, "utf8")
    .update(input, "utf8")
    .digest("hex");
}

export function timingSafeEqualText(left, right) {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
