"use server";

import { headers } from "next/headers";
import { consumeAuthAttempt } from "@/lib/auth/authRateLimit";
import {
  DEFAULT_AUTH_REDIRECT,
  getSafeRedirectPath,
} from "@/lib/auth/safeRedirect";
import { createClient } from "@/utils/supabase/server";

const GENERIC_RESPONSE = Object.freeze({ success: true });

/*
 * O endereço de onde o pedido veio, como o window.location.origin de antes.
 * O Supabase só aceita destinos da lista de redirects permitidos.
 */
async function getRequestOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  if (origin) return new URL(origin).origin;

  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") || "https";
  return new URL(`${proto}://${host}`).origin;
}

export async function requestPasswordReset({ email, locale, next }) {
  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!normalizedEmail) return GENERIC_RESPONSE;

  try {
    const allowed = await consumeAuthAttempt("reset", normalizedEmail);
    if (!allowed) return GENERIC_RESPONSE;

    const safeLocale = locale === "en" ? "en" : "pt";
    const confirmUrl = new URL(
      `/${safeLocale}/reset/confirm`,
      await getRequestOrigin(),
    );
    confirmUrl.searchParams.set(
      "next",
      getSafeRedirectPath(next, `/${safeLocale}${DEFAULT_AUTH_REDIRECT}`),
    );

    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: confirmUrl.toString(),
      flowType: "implicit",
    });
  } catch {
    // A resposta é sempre igual para não revelar contas nem o rate limit.
  }

  return GENERIC_RESPONSE;
}
