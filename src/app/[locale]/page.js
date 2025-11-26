// Always run dynamically (so we can read the auth cookie)
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function LocaleIndex({ params }) {
  const { locale } = await params;
  // READ ONLY: use cookie presence as the signal
  const c = await cookies();
  const isAuthed = !!(c.get("sb-access-token") || c.get("sb:token"));
  redirect(`/${locale}/${isAuthed ? "users" : "login"}`);
}
