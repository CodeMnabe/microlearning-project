// src/middleware.js
import { updateSession } from "@/utils/supabase/middleware";
import { NextResponse } from "next/server";

export function middleware(request) {
  // nothing else: just delegate to updateSession()
  const p = request.nextUrl.pathname;
  if (p.startsWith("/api")) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  matcher: [
    // don’t run on static assets:
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
