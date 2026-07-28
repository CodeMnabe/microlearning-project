export const SENSITIVE_CACHE_CONTROL =
  "private, no-store, no-cache, must-revalidate";

const FORBIDDEN_SHARED_DIRECTIVES = [
  "public",
  "s-maxage",
  "stale-while-revalidate",
];

function directiveName(value) {
  return value.split("=", 1)[0].trim().toLowerCase();
}

export function mergeSensitiveCacheControl(existingValue = "") {
  const required = SENSITIVE_CACHE_CONTROL.split(",").map((value) =>
    value.trim(),
  );
  const normalizedExistingValue =
    typeof existingValue === "string" ? existingValue : "";
  const existing = normalizedExistingValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter(
      (value) => !FORBIDDEN_SHARED_DIRECTIVES.includes(directiveName(value)),
    );

  const merged = new Map();
  for (const value of [...required, ...existing]) {
    const name = directiveName(value);
    if (!merged.has(name)) merged.set(name, value);
  }

  return [...merged.values()].join(", ");
}

export function applySensitiveCacheControl(response) {
  response.headers.set(
    "Cache-Control",
    mergeSensitiveCacheControl(response.headers.get("Cache-Control")),
  );
  return response;
}
