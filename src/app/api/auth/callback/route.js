export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { logger } from "@/lib/observability/logger";
import { SENSITIVE_CACHE_CONTROL } from "@/lib/security/cacheControl";

const SAFE_PATH_PATTERN = /^\/[a-zA-Z0-9/_-]{0,255}$/;
const BLOCKED_PATH_PATTERN = /^\/[/\\]|[\\\\]|[\x00-\x1f\x7f]/;

function getSafeNextPath(raw) {
  if (!raw || typeof raw !== "string") return "/";
  const candidate = decodeURIComponent(raw).split("?")[0].split("#")[0];
  if (!candidate.startsWith("/")) return "/";
  if (BLOCKED_PATH_PATTERN.test(candidate)) return "/";
  if (!SAFE_PATH_PATTERN.test(candidate)) return "/";
  return candidate;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = getSafeNextPath(searchParams.get("next"));

  const headers = {
    "Cache-Control": SENSITIVE_CACHE_CONTROL,
    "X-Robots-Tag": "noindex",
  };

  if (!code) {
    logger.warn("auth_callback_rejected", {
      provider: "supabase",
      operation: "auth_callback",
      outcome: "rejected",
    });
    const errorUrl = new URL(request.url);
    errorUrl.pathname = "/login";
    errorUrl.search = "";
    errorUrl.hash = "";
    return NextResponse.redirect(errorUrl, { status: 302, headers });
  }

  const cookieStore = await cookies();
  const response = NextResponse.redirect(new URL(nextPath, request.url), {
    status: 302,
    headers,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logger.warn("auth_callback_rejected", {
        provider: "supabase",
        operation: "auth_callback",
        outcome: "rejected",
      });
      const loginUrl = new URL(request.url);
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.hash = "";
      return NextResponse.redirect(loginUrl, { status: 302, headers });
    }
  } catch {
    logger.warn("auth_callback_rejected", {
      provider: "supabase",
      operation: "auth_callback",
      outcome: "rejected",
    });
    const loginUrl = new URL(request.url);
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.hash = "";
    return NextResponse.redirect(loginUrl, { status: 302, headers });
  }

  return response;
}
