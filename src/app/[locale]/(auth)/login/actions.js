"use server";

import { createClient } from "@/utils/supabase/server";
import { checkAuthRateLimit } from "@/lib/auth/authRateLimit";
import { logger } from "@/lib/observability/logger";
import { headers } from "next/headers";

const GENERIC_AUTH_ERROR = "auth_invalid_credentials";

async function buildMockRequest() {
  // Build a minimal request-like object from Next.js headers for rate limiting
  const headersList = await headers();
  return {
    headers: {
      get(name) {
        return headersList.get(name);
      },
    },
  };
}

export async function loginAction({ email, password, captchaToken }) {
  if (
    !email ||
    typeof email !== "string" ||
    !password ||
    typeof password !== "string"
  ) {
    return { error: GENERIC_AUTH_ERROR };
  }

  const request = await buildMockRequest();

  // 1. Rate limiting (global -> IP -> account)
  try {
    const capacity = await checkAuthRateLimit(request, "login", email);
    if (!capacity.accepted) {
      logger.warn("auth_login_rate_limited", {
        provider: "supabase",
        operation: "auth_login",
        outcome: "rate_limited",
      });
      return {
        error: "auth_rate_limited",
        retryAfter: capacity.retryAfterSeconds,
      };
    }
  } catch {
    // Rate limiter failure should not block login entirely, but log it
    logger.error("api_request_failed", {
      provider: "internal",
      operation: "api_handler",
      outcome: "failed",
      statusCode: 500,
    });
  }

  // 3. Authenticate
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
    options: { captchaToken },
  });

  if (error) {
    logger.info("auth_login_rejected", {
      provider: "supabase",
      operation: "auth_login",
      outcome: "rejected",
    });
    return { error: GENERIC_AUTH_ERROR };
  }

  logger.info("auth_login_succeeded", {
    provider: "supabase",
    operation: "auth_login",
    outcome: "succeeded",
  });

  return { success: true };
}
