import { NextResponse } from "next/server";
import { createDeduplicatedContact } from "@/lib/repos/contact.repo";
import { logger } from "@/lib/observability/logger";
import { readBoundedJson, RequestBodyError } from "@/lib/http/boundedJson";
import {
  CONTACT_BODY_MAX_BYTES,
  CONTACT_DEDUPE_WINDOW_SECONDS,
  CONTACT_RATE_LIMITS,
} from "@/lib/limits/publicAbuse";
import {
  ContactValidationError,
  validateContactSubmission,
} from "@/lib/services/contact/contactValidation";
import { verifyContactCaptcha } from "@/lib/services/contact/turnstile";
import { deriveClientIdentity } from "@/lib/security/clientIdentity";
import { deriveOpaqueIdentifier } from "@/lib/security/opaqueIdentity";
import { consumeCapacitySet } from "@/lib/repos/requestCapacity.repo";

const GENERIC_ERROR = "Unable to submit the form.";

function jsonError(status, headers = undefined) {
  return NextResponse.json({ error: GENERIC_ERROR }, { status, headers });
}

export async function POST(request) {
  try {
    const body = await readBoundedJson(request, CONTACT_BODY_MAX_BYTES);
    const submission = validateContactSubmission(body);
    const captchaAccepted = await verifyContactCaptcha(submission.captchaToken);
    if (!captchaAccepted) return jsonError(400);

    const { subjectHash: ipSubject } = deriveClientIdentity(
      request,
      "contact-ip",
    );
    const emailSubject = deriveOpaqueIdentifier(
      "contact-email",
      submission.email,
    );
    const globalSubject = deriveOpaqueIdentifier("contact-global", "all");
    const capacity = await consumeCapacitySet([
      {
        scope: "contact-global",
        subjectHash: globalSubject,
        ...CONTACT_RATE_LIMITS.global,
      },
      {
        scope: "contact-ip",
        subjectHash: ipSubject,
        ...CONTACT_RATE_LIMITS.ip,
      },
      {
        scope: "contact-email",
        subjectHash: emailSubject,
        ...CONTACT_RATE_LIMITS.email,
      },
    ]);
    if (!capacity.accepted) {
      return jsonError(429, {
        "Retry-After": String(capacity.retryAfterSeconds),
      });
    }


    const fingerprint = deriveOpaqueIdentifier(
      "contact-submission",
      JSON.stringify([
        submission.name,
        submission.email,
        submission.company,
        submission.message,
      ]),
    );
    await createDeduplicatedContact({
      name: submission.name,
      email: submission.email,
      company: submission.company,
      message: submission.message,
      fingerprint,
      windowSeconds: CONTACT_DEDUPE_WINDOW_SECONDS,
    });

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    if (
      error instanceof RequestBodyError ||
      error instanceof ContactValidationError
    ) {
      return jsonError(error.status);
    }
    logger.error(
      "contact_submission_failed",
      {
        provider: "supabase",
        operation: "contact_create",
        outcome: "failed",
      },
      error,
    );
    return jsonError(500);
  }
}
