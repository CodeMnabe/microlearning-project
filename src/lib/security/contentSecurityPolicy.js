import crypto from "crypto";

export function generateNonce() {
  return crypto.randomBytes(16).toString("base64");
}

export function getSupabaseOrigin(isProduction) {
  const urlString = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!urlString) {
    if (isProduction) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL is required in production");
    }
    return null; // fallback em dev se não estiver configurado, mas tipicamente estará
  }

  try {
    const url = new URL(urlString);

    if (url.username || url.password) {
      throw new Error("Supabase URL cannot contain credentials");
    }

    if (
      isProduction &&
      url.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname)
    ) {
      throw new Error("Supabase URL must use HTTPS in production");
    }

    // Origin remove paths, queries, hashes
    return url.origin;
  } catch (err) {
    throw new Error(`Invalid NEXT_PUBLIC_SUPABASE_URL: ${err.message}`);
  }
}

export function buildContentSecurityPolicy(nonce, isProduction) {
  const supabaseOrigin = getSupabaseOrigin(isProduction);

  const directives = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "https://challenges.cloudflare.com",
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", "https://challenges.cloudflare.com"],
    "frame-src": ["'self'", "https://challenges.cloudflare.com"],
  };

  if (supabaseOrigin) {
    directives["img-src"].push(supabaseOrigin);
    directives["connect-src"].push(supabaseOrigin);
  }

  if (!isProduction) {
    directives["script-src"].push("'unsafe-eval'");
  } else {
    directives["upgrade-insecure-requests"] = [];
  }

  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) return key;
      return `${key} ${values.join(" ")}`;
    })
    .join("; ");
}
