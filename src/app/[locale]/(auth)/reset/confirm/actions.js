"use server";

import { isPasswordAllowed } from "@/lib/auth/passwordPolicy";
import { createClient } from "@/utils/supabase/server";

export async function changePassword(password) {
  if (!isPasswordAllowed(password)) {
    return { error: "password_policy" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return { error: "password_change_failed" };

    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: "password_change_failed" };

    return { success: true };
  } catch {
    return { error: "password_change_failed" };
  }
}
