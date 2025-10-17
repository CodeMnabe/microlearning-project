// src/app/api/auth/signout/route.js
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST() {
  const cookieStore = await cookies(); // ← important on Next 15+
  const res = NextResponse.json({ ok: true }, { status: 200 });

  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        // write to the RESPONSE so the browser updates its cookies
        res.cookies.set({ name, value, ...options });
      },
      remove(name, options) {
        res.cookies.set({ name, value: "", ...options, maxAge: 0, path: "/" });
      },
    },
  });

  // Ask Supabase to clear its auth cookies
  try {
    await supabase.auth.signOut();
  } catch {}

  // Belt & suspenders: directly zero the two cookies by name
  const ref = url?.match(/^https:\/\/([^.]+)\.supabase\.co/i)?.[1] ?? "";
  for (const name of [`sb-${ref}-auth-token`, `sb-${ref}-refresh-token`]) {
    res.cookies.set({
      name,
      value: "",
      maxAge: 0,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });
  }

  res.headers.set("Cache-Control", "no-store");
  return res;
}
