// src/middleware.js
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { updateSession } from "@/utils/supabase/middleware";
import { NextResponse } from "next/server";

const intl = createMiddleware(routing);

const PUBLIC = [
  /^\/(pt|en)\/login$/,
  /^\/(pt|en)\/reset\/confirm$/,
  /^\/(pt|en)\/reset(\/request)?$/, // if you use /reset or /reset/request
  /^\/$/, // homepage
  /^\/(pt|en)$/, // locale root
];

export function middleware(request) {
  const url = new URL(request.url);
  const p = url.pathname;

  // Skip API/Next/static
  if (p.startsWith("/api") || p.startsWith("/_next") || /\.[\w]+$/.test(p)) {
    return NextResponse.next();
  }

  // Let next-intl handle locale redirects/rewrites first
  const intlRes = intl(request);
  if (intlRes) return intlRes;

  // Always allow public routes (including reset) without auth redirects
  if (PUBLIC.some((re) => re.test(p))) {
    // Still refresh Supabase cookies if present, but don't redirect
    const res = NextResponse.next();
    const sessionRes = updateSession(request);
    if (sessionRes?.cookies?.getAll) {
      for (const c of sessionRes.cookies.getAll()) res.cookies.set(c);
    }
    return res;
  }

  // For everything else, keep your existing session logic
  const sessionRes = updateSession(request);
  if (sessionRes instanceof Response) return sessionRes;
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
