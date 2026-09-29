export const DEFAULT_AUTH_REDIRECT = "/users";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export function getSafeRedirectPath(
  value,
  fallback = DEFAULT_AUTH_REDIRECT,
) {
  if (typeof value !== "string" || value.length === 0 || value.length > 256) {
    return fallback;
  }

  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }

  for (const candidate of [value, decoded]) {
    const pathname = candidate.split(/[?#]/, 1)[0];
    if (
      !candidate.startsWith("/") ||
      pathname === "/" ||
      candidate.startsWith("//") ||
      candidate.startsWith("/\\") ||
      CONTROL_CHARACTERS.test(candidate)
    ) {
      return fallback;
    }
  }

  if (value.toLowerCase().startsWith("/%2f")) return fallback;

  return value;
}
