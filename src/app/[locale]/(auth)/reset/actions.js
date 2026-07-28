"use server";

import { createClient } from "@/utils/supabase/server";
import { checkAuthRateLimit } from "@/lib/auth/authRateLimit";
import { getAuthCallbackUrl } from "@/lib/auth/redirectValidation";
import { logger } from "@/lib/observability/logger";
import { headers } from "next/headers";

async function buildMockRequest() {
  const headersList = await headers();
  return {
    headers: {
      get(name) {
        return headersList.get(name);
      },
    },
  };
}

export async function requestPasswordReset({ email, captchaToken, locale }) {
  if (!email || typeof email !== "string") {
    // Always return success to prevent enumeration
    return { success: true };
  }

  const request = await buildMockRequest();

  // 1. Rate limiting (global -> IP -> account)
  try {
    const capacity = await checkAuthRateLimit(request, "reset", email);
    if (!capacity.accepted) {
      logger.warn("auth_password_reset_rate_limited", {
        provider: "supabase",
        operation: "auth_password_reset",
        outcome: "rate_limited",
      });
      return {
        error: "auth_rate_limited",
        retryAfter: capacity.retryAfterSeconds,
      };
    }
  } catch {
    logger.error("api_request_failed", {
      provider: "internal",
      operation: "api_handler",
      outcome: "failed",
      statusCode: 500,
    });
  }

  // 3. Build redirect URL pointing to the auth callback
  const confirmPath =
    locale && locale !== "pt" ? `/${locale}/reset/confirm` : "/reset/confirm";
  const redirectTo = getAuthCallbackUrl(confirmPath);

  // 4. Request password reset
  const supabase = await createClient();
  try {
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
      captchaToken,
    });
  } catch {
    // Swallow errors to prevent enumeration
  }

  logger.info("auth_password_reset_requested", {
    provider: "supabase",
    operation: "auth_password_reset",
    outcome: "requested",
  });

  // Always return success regardless of whether email exists
  return { success: true };
}
