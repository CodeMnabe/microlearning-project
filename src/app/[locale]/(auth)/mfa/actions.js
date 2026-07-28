"use server";

import { logger } from "@/lib/observability/logger";

export async function enrollMfa() {
  logger.info("auth_mfa_enrollment_started", {
    provider: "supabase",
    operation: "auth_mfa_enrollment",
    outcome: "started",
  });
}

export async function verifyMfa() {
  logger.info("auth_mfa_verified", {
    provider: "supabase",
    operation: "auth_mfa_verify",
    outcome: "verified",
  });
}

export async function rejectMfa() {
  logger.warn("auth_mfa_rejected", {
    provider: "supabase",
    operation: "auth_mfa_verify",
    outcome: "rejected",
  });
}
