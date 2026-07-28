"use server";

import createSupabaseServerClient from "@/utils/supabase/server";
import { validatePasswordWithConfirmation } from "@/lib/auth/passwordPolicy";
import { logger } from "@/lib/observability/logger";

const GENERIC_FAILURE = Object.freeze({
  success: false,
  error: "password_change_failed",
});

export async function changePassword(input) {
  const password = input?.password;
  const confirmPassword = input?.confirmPassword;

  if (validatePasswordWithConfirmation(password, confirmPassword).length > 0) {
    return GENERIC_FAILURE;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return GENERIC_FAILURE;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      return GENERIC_FAILURE;
    }

    logger.info("auth_password_changed", {
      provider: "supabase",
      operation: "change_password",
      outcome: "changed",
    });

    const { error: signOutError } = await supabase.auth.signOut({
      scope: "local",
    });
    if (signOutError) {
      return GENERIC_FAILURE;
    }

    return { success: true };
  } catch {
    return GENERIC_FAILURE;
  }
}
