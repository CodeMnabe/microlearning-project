"use client";
import { createBrowserClient } from "@supabase/ssr";

// DO NOT use require('dotenv') in the browser.
// NEXT_PUBLIC_* vars are inlined at build.

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { fetch: fetch.bind(globalThis) },
      auth: {
        flowType: "implicit",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );
}

// (optional) also export default
export const createClient = createSupabaseBrowserClient;
export default createSupabaseBrowserClient;
