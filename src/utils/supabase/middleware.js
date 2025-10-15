// src/utils/supabase/middleware.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function updateSession(request) {
  // Prepare a Next.js response we can add cookies to
  let response = NextResponse.next({ request });

  // Make a Supabase server client bound to *this* request’s cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookies) {
          // push new/updated cookies into the outgoing response
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
      auth: {
        flowType: "implicit",
      },
    }
  );

  // Always re-validate the auth token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Example: protect all routes except /login & /auth/*
  const path = request.nextUrl.pathname;
  if (
    !user &&
    !path.startsWith("/login") &&
    !path.startsWith("/auth") &&
    !path.startsWith("/reset")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/users"; // or "/assistants"
    return NextResponse.redirect(url);
  }

  return response;
}
