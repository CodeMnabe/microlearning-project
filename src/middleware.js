// src/middleware.js
import { updateSession } from "@/utils/supabase/middleware";

export function middleware(request) {
  // nothing else: just delegate to updateSession()
  return updateSession(request);
}

export const config = {
  matcher: [
    // don’t run on static assets:
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
