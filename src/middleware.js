// src/middleware.js
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextResponse } from "next/server";
// import { updateSession } from "@/utils/supabase/middleware"; // ← don't run on public

const intl = createMiddleware(routing);

// Public routes that must never be redirected to /login
const PUBLIC = [
  /^\/(pt|en)\/login$/,
  /^\/(pt|en)\/reset\/confirm$/,
  /^\/(pt|en)\/reset(\/request)?$/,
  /^\/$/,
  /^\/(pt|en)$/,
];

export function middleware(request) {
  const p = new URL(request.url).pathname;

  // Skip API/Next/static
  if (p.startsWith("/api") || p.startsWith("/_next") || /\.[\w]+$/.test(p)) {
    return NextResponse.next();
  }

  // Locale handling first (may redirect only to add the locale)
  const intlRes = intl(request);
  if (intlRes) return intlRes;

  // Allow public routes with NO auth guard at all
  if (PUBLIC.some((re) => re.test(p))) {
    return NextResponse.next();
  }

  // For the rest of your app you can run your usual session logic here
  // const sessionRes = updateSession(request);
  // if (sessionRes instanceof Response) return sessionRes;
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
