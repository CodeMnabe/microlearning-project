import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
      auth: {
        flowType: "implicit",
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return {
    response,
    user: error ? null : user,
  };
}
