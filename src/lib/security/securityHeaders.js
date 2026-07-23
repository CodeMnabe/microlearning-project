export function getSecurityHeaders(isProduction) {
  const headers = new Map();

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=(), interest-cohort=(), fullscreen=(), display-capture=(), screen-wake-lock=()",
  );
  headers.set("X-DNS-Prefetch-Control", "off");
  headers.set("X-XSS-Protection", "0");

  if (isProduction) {
    // Include subdomains and preload should only be added after careful verification.
    headers.set("Strict-Transport-Security", "max-age=31536000");
  }

  return headers;
}
