export function buildSecurityHeaders({ supabaseUrl, isProduction, isVercelPreview }) {
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null;
  const scriptSources = ["'self'", "'unsafe-inline'"];
  if (!isProduction) scriptSources.push("'unsafe-eval'");
  if (isVercelPreview) scriptSources.push("https://vercel.live");

  const connectSources = ["'self'"];
  if (supabaseOrigin) connectSources.push(supabaseOrigin);
  if (isVercelPreview) {
    connectSources.push("https://vercel.live", "wss://ws-us3.pusher.com");
  }

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    "media-src 'self' blob:",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  if (isProduction) directives.push("upgrade-insecure-requests");

  const headers = [
    { key: "Content-Security-Policy", value: directives.join("; ") },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
    { key: "X-Frame-Options", value: "DENY" },
  ];
  if (isProduction) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }
  return headers;
}
