import { cache } from "react";
import createSupabaseServerClient from "@/utils/supabase/server";

/**
 * Resolves the signed-in user for the current request. Wrapped in React's
 * `cache` so a layout and its `generateMetadata` share one auth round trip.
 */
export const getCurrentSession = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { supabase, user: error ? null : (user ?? null) };
});
