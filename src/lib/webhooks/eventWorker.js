import {
  claimWebhookEvents,
  renewWebhookEventLease,
  transitionWebhookEvent,
} from "@/lib/repos/webhookEvents.repo";
import crypto from "node:crypto";
import { WebhookEffectStateError } from "@/lib/webhooks/effectRunner";
import { startLeaseHeartbeat } from "@/lib/webhooks/leaseHeartbeat";

const DEFAULT_LIMIT = 25;
const DEFAULT_LEASE_SECONDS = 120;
const DEFAULT_MAX_ATTEMPTS = 8;

export function webhookRetryAt(attemptCount, now = Date.now()) {
  const seconds = Math.min(30 * 2 ** Math.max(attemptCount - 1, 0), 3600);
  return new Date(now + seconds * 1000).toISOString();
}

export function webhookStateForError(error, attemptCount, maxAttempts) {
  const requested = error?.webhookState;
  if (requested === "unknown_outcome") return "unknown_outcome";
  if (requested === "failed" || requested === "conflict") return "failed";
  if (attemptCount >= maxAttempts) return "failed";
  return "retryable_failed";
}

function eventPayload(event) {
  if (event.provider === "messagebird") return event.metadata?.event || null;
  if (event.provider === "teams") return event.metadata?.activity || null;
  return null;
}

export async function processClaimedWebhookEvent(event, options = {}) {
  const maxAttempts = Math.min(
    Math.max(Number(options.maxAttempts || DEFAULT_MAX_ATTEMPTS), 1),
    20,
  );
  const context = {
    eventId: event.id,
    organizationId: event.organization_id,
    claimToken: event.claim_token,
    workerId: options.workerId,
    leaseSeconds: options.leaseSeconds || DEFAULT_LEASE_SECONDS,
    provider: event.provider,
    scopeId: event.scope_id,
  };
  const heartbeat = startLeaseHeartbeat({
    label: "webhook event",
    leaseSeconds: context.leaseSeconds,
    renew: () =>
      renewWebhookEventLease({
        eventId: context.eventId,
        organizationId: context.organizationId,
        claimToken: context.claimToken,
        leaseSeconds: context.leaseSeconds,
      }),
  });

  try {
    const payload = eventPayload(event);
    if (!payload) {
      const error = new Error("Stored webhook payload is incomplete");
      error.webhookState = "failed";
      throw error;
    }

    if (event.provider === "messagebird") {
      const { processMessageBirdWebhookEvent } =
        await import("@/app/api/messagebird/route");
      await processMessageBirdWebhookEvent(payload, context);
    } else if (event.provider === "teams") {
      const { processTeamsWebhookEvent } =
        await import("@/app/api/teams/messages/route");
      await processTeamsWebhookEvent(payload, context);
    } else {
      const error = new Error("Stored webhook provider is not supported");
      error.webhookState = "failed";
      throw error;
    }

    heartbeat.assertOwned();

    const transitioned = await transitionWebhookEvent({
      eventId: event.id,
      organizationId: event.organization_id,
      claimToken: event.claim_token,
      status: "succeeded",
    });

    return transitioned
      ? { id: event.id, outcome: "succeeded" }
      : { id: event.id, outcome: "claim_lost" };
  } catch (error) {
    if (error?.claimLost) {
      return { id: event.id, outcome: "claim_lost" };
    }
    const status = webhookStateForError(
      error,
      event.attempt_count,
      maxAttempts,
    );
    const transitioned = await transitionWebhookEvent({
      eventId: event.id,
      organizationId: event.organization_id,
      claimToken: event.claim_token,
      status,
      lastError: error?.message || String(error),
      nextAttemptAt:
        status === "retryable_failed"
          ? webhookRetryAt(event.attempt_count)
          : null,
    });

    return transitioned
      ? {
          id: event.id,
          outcome: status,
          error: error?.message || String(error),
          effectState:
            error instanceof WebhookEffectStateError
              ? error.webhookState
              : error?.webhookState || null,
        }
      : { id: event.id, outcome: "claim_lost" };
  } finally {
    await heartbeat.stop();
  }
}

export async function processWebhookEventBatch(options = {}) {
  const limit = Math.min(
    Math.max(Number(options.limit || DEFAULT_LIMIT), 1),
    100,
  );
  const workerId = options.workerId || `webhook-worker-${crypto.randomUUID()}`;
  const leaseSeconds = Math.min(
    Math.max(Number(options.leaseSeconds || DEFAULT_LEASE_SECONDS), 15),
    900,
  );
  const events = await claimWebhookEvents({ workerId, limit, leaseSeconds });
  const results = [];

  for (const event of events) {
    results.push(
      await processClaimedWebhookEvent(event, {
        workerId,
        leaseSeconds,
        maxAttempts: options.maxAttempts,
      }),
    );
  }

  return { workerId, claimed: events.length, results };
}
