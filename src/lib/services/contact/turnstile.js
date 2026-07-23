import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEFAULT_TIMEOUT_MS = 3000;

function getConfiguration() {
  const secret = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
  const action = String(process.env.TURNSTILE_EXPECTED_ACTION || "").trim();
  const hostnames = String(process.env.TURNSTILE_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!secret || !action || hostnames.length === 0) {
    throw new Error("Turnstile configuration is incomplete");
  }
  return { secret, action, hostnames };
}

export async function verifyContactCaptcha(token, { fetchImpl = fetch } = {}) {
  const { secret, action, hostnames } = getConfiguration();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const body = new URLSearchParams({ secret, response: token });
    const response = await fetchImpl(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return false;
    const result = await response.json();
    return (
      result?.success === true &&
      result?.action === action &&
      typeof result?.hostname === "string" &&
      hostnames.includes(result.hostname.toLowerCase())
    );
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
