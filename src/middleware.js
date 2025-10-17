// src/middleware.js
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { updateSession } from "@/utils/supabase/middleware";
import { NextResponse } from "next/server";

const intl = createMiddleware(routing);

export function middleware(request) {
  // Let next-intl handle locale (may return a Response for redirect/rewrite)
  const intlRes = intl(request);

  // Run Supabase session update (may return Response OR undefined)
  const sessionRes = updateSession(request);

  // If intl gave us a Response, keep it (so redirects/rewrites work),
  // and copy any cookies from sessionRes if available.
  if (intlRes) {
    if (sessionRes && sessionRes.cookies?.getAll) {
      for (const c of sessionRes.cookies.getAll()) {
        intlRes.cookies.set(c);
      }
    }
    return intlRes;
  }

  // Otherwise prefer the session response if it exists; else fall back to next()
  if (sessionRes instanceof Response) return sessionRes;
  return NextResponse.next();
}

// Match everything except API, Next internals, and static files
export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
