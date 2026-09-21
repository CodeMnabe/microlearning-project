"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { consumeAuthAttempt } from "@/lib/auth/authRateLimit";

export async function login({ email, password }) {
  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!normalizedEmail || typeof password !== "string") {
    return { error: "auth_failed" };
  }

  try {
    const allowed = await consumeAuthAttempt("login", normalizedEmail);
    if (!allowed) return { error: "auth_failed" };

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) return { error: "auth_failed" };
    return { success: true };
  } catch {
    return { error: "auth_failed" };
  }
}

export async function signup(formData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (error) redirect("/error");
  redirect("/login"); // user still must confirm e-mail
}
