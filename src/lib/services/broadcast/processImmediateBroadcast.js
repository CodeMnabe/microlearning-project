import {
  claimImmediateBroadcastDelivery,
  completeImmediateBroadcastDelivery,
  getImmediateBroadcastRequestSummary,
  markImmediateBroadcastDeliverySendStarted,
  renewImmediateBroadcastRequestLease,
} from "@/lib/repos/immediateBroadcasts.repo";
import {
  compactProviderResult,
  runWithConcurrency,
} from "./immediateBroadcast";

function outcomeForProviderResult(result) {
  if (result?.ok) return "sent";
  const status = Number(result?.status || 0);
  return status >= 400 && status < 500 ? "failed" : "unknown_outcome";
}

export async function processImmediateBroadcast({
  requestId,
  organizationId,
  actorUserId,
  workerId,
  requestClaimToken,
  recipientUserIds,
  concurrency,
  sendRecipient,
}) {
  let ownershipLost = false;
  if (
    !(await renewImmediateBroadcastRequestLease({
      requestId,
      organizationId,
      actorUserId,
      requestClaimToken,
      workerId,
    }))
  ) {
    throw new Error("Immediate broadcast request ownership was lost");
  }
  const heartbeat = setInterval(async () => {
    if (ownershipLost) return;
    try {
      if (
        !(await renewImmediateBroadcastRequestLease({
          requestId,
          organizationId,
          actorUserId,
          requestClaimToken,
          workerId,
        }))
      )
        ownershipLost = true;
    } catch {
      ownershipLost = true;
    }
  }, 30000);
  try {
    const results = await runWithConcurrency(
      recipientUserIds,
      concurrency,
      async (userId) => {
        if (ownershipLost)
          return { userId, ok: false, status: "ownership_lost", skipped: true };
        const claim = await claimImmediateBroadcastDelivery({
          requestId,
          organizationId,
          actorUserId,
          requestClaimToken,
          userId,
          workerId,
        });
        if (!claim || claim.outcome !== "claimed") {
          return {
            userId,
            ok: false,
            status: claim?.outcome || "not_claimed",
            skipped: true,
          };
        }

        let sendStarted = false;
        try {
          const result = await sendRecipient({
            userId,
            deliveryId: claim.delivery_id,
            beforeProviderSend: async () => {
              const started = await markImmediateBroadcastDeliverySendStarted({
                deliveryId: claim.delivery_id,
                requestId,
                organizationId,
                requestClaimToken,
                claimToken: claim.claim_token,
                workerId,
              });
              if (!started)
                throw new Error(
                  "Immediate broadcast delivery claim was lost before send",
                );
              sendStarted = true;
            },
          });
          const provider = compactProviderResult(result);
          const outcome = outcomeForProviderResult(result);
          await completeImmediateBroadcastDelivery({
            deliveryId: claim.delivery_id,
            requestId,
            organizationId,
            requestClaimToken,
            claimToken: claim.claim_token,
            workerId,
            outcome,
            providerMessageId: provider.providerMessageId,
            providerResult: provider,
            lastError:
              outcome === "sent"
                ? null
                : result?.error || result?.data?.error || null,
          });
          return { userId, ok: outcome === "sent", status: outcome };
        } catch (error) {
          const outcome = sendStarted ? "unknown_outcome" : "failed";
          await completeImmediateBroadcastDelivery({
            deliveryId: claim.delivery_id,
            requestId,
            organizationId,
            requestClaimToken,
            claimToken: claim.claim_token,
            workerId,
            outcome,
            lastError: error?.message || "Immediate broadcast delivery failed",
          });
          return { userId, ok: false, status: outcome };
        }
      },
    );
    return getImmediateBroadcastRequestSummary({
      requestId,
      organizationId,
      actorUserId,
      results,
    });
  } finally {
    clearInterval(heartbeat);
  }
}
