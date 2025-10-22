// Always run dynamically (so we can read the auth cookie)
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function LocaleIndex({ params: { locale } }) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // If logged in -> /users, else -> /login
  redirect(`/${locale}/${session ? "users" : "login"}`);
}
