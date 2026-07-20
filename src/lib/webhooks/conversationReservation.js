import {
  associateConversationReservationThread,
  claimConversationReservation,
  markConversationReservationRemoteStarted,
  registerConversationReservation,
  renewConversationReservationLease,
  transitionConversationReservation,
} from "@/lib/repos/conversationReservations.repo";
import { getThreadById } from "@/lib/repos/threads.repo";
import { WebhookEffectStateError } from "@/lib/webhooks/effectRunner";
import { startLeaseHeartbeat } from "@/lib/webhooks/leaseHeartbeat";

async function resolvedThread(threadId) {
  if (!threadId) return null;
  return getThreadById(threadId);
}

export async function getOrCreateReservedThread({
  context,
  userId = null,
  assistantId,
  channel,
  existingThread = null,
  createRemoteThread,
  createLocalThread,
}) {
  if (!context?.eventId || !context?.provider || !context?.scopeId) {
    if (existingThread) return existingThread;
    const remote = await createRemoteThread();
    return createLocalThread(remote);
  }

  const reservation = await registerConversationReservation({
    organizationId: context.organizationId,
    provider: context.provider,
    scopeId: context.scopeId,
    userId,
    assistantId,
    channel,
    existingThreadId: existingThread?.id || null,
  });

  if (reservation.current_thread_id) {
    const thread = await resolvedThread(reservation.current_thread_id);
    if (thread) return thread;
  }

  const claim = await claimConversationReservation({
    reservationId: reservation.id,
    organizationId: context.organizationId,
    leaseSeconds: context.leaseSeconds || 120,
  });
  if (!claim) {
    throw new WebhookEffectStateError(
      "Conversation reservation claim was lost",
      "retryable_failed",
    );
  }
  if (claim.outcome === "ready") {
    const thread = await resolvedThread(claim.current_thread_id);
    if (thread) return thread;
  }
  if (claim.outcome !== "claimed") {
    throw new WebhookEffectStateError(
      `Conversation reservation is not executable: ${claim.outcome}`,
      claim.outcome === "unknown_outcome"
        ? "unknown_outcome"
        : "retryable_failed",
    );
  }

  const heartbeat = startLeaseHeartbeat({
    label: "conversation reservation",
    leaseSeconds: context.leaseSeconds || 120,
    renew: () =>
      renewConversationReservationLease({
        reservationId: claim.reservation_id,
        organizationId: context.organizationId,
        claimToken: claim.reservation_claim_token,
        leaseSeconds: context.leaseSeconds || 120,
      }),
  });
  let remoteStarted = false;

  try {
    const marked = await markConversationReservationRemoteStarted({
      reservationId: claim.reservation_id,
      organizationId: context.organizationId,
      claimToken: claim.reservation_claim_token,
    });
    if (!marked) throw new Error("Conversation reservation claim was lost");
    remoteStarted = true;

    const remoteThread = await createRemoteThread();
    heartbeat.assertOwned();
    const localThread = await createLocalThread(remoteThread);
    heartbeat.assertOwned();

    const associated = await associateConversationReservationThread({
      reservationId: claim.reservation_id,
      organizationId: context.organizationId,
      claimToken: claim.reservation_claim_token,
      threadId: localThread.id,
    });
    if (!associated) throw new Error("Conversation reservation claim was lost");

    const completed = await transitionConversationReservation({
      reservationId: claim.reservation_id,
      organizationId: context.organizationId,
      claimToken: claim.reservation_claim_token,
      status: "ready",
    });
    if (!completed) throw new Error("Conversation reservation claim was lost");
    return localThread;
  } catch (error) {
    const status = remoteStarted ? "unknown_outcome" : "retryable_failed";
    await transitionConversationReservation({
      reservationId: claim.reservation_id,
      organizationId: context.organizationId,
      claimToken: claim.reservation_claim_token,
      status,
      lastError: error?.message || String(error),
    }).catch(() => null);
    throw new WebhookEffectStateError(error?.message || String(error), status);
  } finally {
    await heartbeat.stop();
  }
}
