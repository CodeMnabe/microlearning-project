import {
  claimWebhookEffect,
  registerWebhookEffect,
  renewWebhookEffectLease,
  renewWebhookEventLease,
  transitionWebhookEffect,
} from "@/lib/repos/webhookEvents.repo";
import { hashWebhookValue } from "@/lib/webhooks/eventIdentity";
import { withLeaseHeartbeat } from "@/lib/webhooks/leaseHeartbeat";

export class WebhookEffectStateError extends Error {
  constructor(message, webhookState, details = {}) {
    super(message);
    this.name = "WebhookEffectStateError";
    this.webhookState = webhookState;
    this.details = details;
  }
}

function retryAt(attemptCount = 1) {
  const seconds = Math.min(30 * 2 ** Math.max(attemptCount - 1, 0), 3600);
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function serializeResult(result) {
  if (result === undefined) return {};
  if (result === null) return {};
  if (Array.isArray(result)) return result;
  if (typeof result === "object") return result;
  return { value: result };
}

function errorState(error, isExternal) {
  if (error?.webhookState) return error.webhookState;
  if (error?.beforeExternalRequest === true) return "retryable_failed";
  return isExternal ? "unknown_outcome" : "retryable_failed";
}

export async function runWebhookEffect({
  context,
  effectType,
  effectKey = "default",
  isExternal = false,
  request = {},
  operation,
  classifyResult = null,
}) {
  if (!context?.eventId || !context?.claimToken || !context?.workerId) {
    return operation();
  }

  const requestHash = hashWebhookValue(request);
  const effect = await registerWebhookEffect({
    eventId: context.eventId,
    organizationId: context.organizationId,
    eventClaimToken: context.claimToken,
    effectType,
    effectKey,
    isExternal,
    requestHash,
  });

  if (effect.status === "conflict") {
    throw new WebhookEffectStateError(
      "Stored effect request differs from the claimed request",
      "conflict",
      { effectType, effectKey },
    );
  }

  const claim = await claimWebhookEffect({
    effectId: effect.id,
    eventId: context.eventId,
    organizationId: context.organizationId,
    eventClaimToken: context.claimToken,
    workerId: context.workerId,
    leaseSeconds: context.leaseSeconds || 120,
  });

  if (!claim) {
    throw new WebhookEffectStateError(
      "Webhook effect claim was lost",
      "retryable_failed",
      { effectType, effectKey },
    );
  }

  if (claim.outcome === "duplicate_succeeded") {
    return claim.result || {};
  }

  if (claim.outcome !== "claimed") {
    const state =
      claim.outcome === "duplicate_processing" || claim.outcome === "not_due"
        ? "retryable_failed"
        : claim.outcome;
    throw new WebhookEffectStateError(
      `Webhook effect is not executable: ${claim.outcome}`,
      state,
      { effectType, effectKey },
    );
  }

  try {
    const result = await withLeaseHeartbeat(
      {
        label: "webhook effect",
        leaseSeconds: context.leaseSeconds || 120,
        renew: async () => {
          const event = await renewWebhookEventLease({
            eventId: context.eventId,
            organizationId: context.organizationId,
            claimToken: context.claimToken,
            leaseSeconds: context.leaseSeconds || 120,
          });
          if (!event) return null;
          return renewWebhookEffectLease({
            effectId: claim.effect_id,
            eventId: context.eventId,
            organizationId: context.organizationId,
            eventClaimToken: context.claimToken,
            effectClaimToken: claim.effect_claim_token,
            leaseSeconds: context.leaseSeconds || 120,
          });
        },
      },
      operation,
    );
    const classification = classifyResult
      ? classifyResult(result)
      : { status: "succeeded" };
    const status = classification?.status || "succeeded";

    const transitioned = await transitionWebhookEffect({
      effectId: claim.effect_id,
      eventId: context.eventId,
      organizationId: context.organizationId,
      eventClaimToken: context.claimToken,
      effectClaimToken: claim.effect_claim_token,
      status,
      result: serializeResult(result),
      providerReference: classification?.providerReference || null,
      lastError: classification?.lastError || null,
      nextAttemptAt:
        status === "retryable_failed"
          ? retryAt(effect.attempt_count + 1)
          : null,
    });

    if (!transitioned) {
      throw new WebhookEffectStateError(
        "Webhook effect transition lost its claim",
        isExternal ? "unknown_outcome" : "retryable_failed",
        { effectType, effectKey, effectSettled: true },
      );
    }

    if (status !== "succeeded") {
      throw new WebhookEffectStateError(
        classification?.lastError || `Webhook effect ended as ${status}`,
        status,
        { effectType, effectKey, effectSettled: true },
      );
    }

    return result;
  } catch (error) {
    if (
      error instanceof WebhookEffectStateError &&
      error.details?.effectSettled
    ) {
      throw error;
    }

    const state = errorState(error, isExternal);
    await transitionWebhookEffect({
      effectId: claim.effect_id,
      eventId: context.eventId,
      organizationId: context.organizationId,
      eventClaimToken: context.claimToken,
      effectClaimToken: claim.effect_claim_token,
      status: state === "conflict" ? "failed" : state,
      lastError: error?.message || String(error),
      nextAttemptAt:
        state === "retryable_failed" ? retryAt(effect.attempt_count + 1) : null,
    });

    throw new WebhookEffectStateError(error?.message || String(error), state, {
      effectType,
      effectKey,
      effectSettled: true,
    });
  }
}

export function classifyProviderResult(result) {
  if (result?.ok) {
    return {
      status: "succeeded",
      providerReference: result.providerMessageId || result.id || null,
    };
  }

  if (result?.outcome === "unknown") {
    return {
      status: "unknown_outcome",
      lastError: "Provider outcome is unknown",
    };
  }

  const statusCode = Number(result?.status || 0);
  return {
    status: statusCode >= 500 ? "retryable_failed" : "failed",
    lastError: `Provider rejected the request with status ${statusCode || "unknown"}`,
  };
}
