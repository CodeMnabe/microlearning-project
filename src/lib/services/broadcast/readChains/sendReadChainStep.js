import crypto from "node:crypto";
import { logger } from "@/lib/observability/logger";
import { sendWhatsappBroadcast } from "@/lib/services/broadcast/sendWhatsappBroadcast";
import { createMessage } from "@/lib/repos/messages.repo";
import {
  claimMessageChainDelivery,
  completeMessageChainDeliverySend,
  ensureMessageChainDelivery,
  failMessageChainDeliveryAfterSend,
  failMessageChainDeliveryBeforeSend,
  markMessageChainDeliverySendStarted,
  markMessageChainDeliveryUnknownOutcome,
  renewMessageChainDeliveryLease,
} from "@/lib/repos/messageChain.repo";
import { withLeaseHeartbeat } from "@/lib/webhooks/leaseHeartbeat";

const DEFAULT_LEASE_SECONDS = 120;

function getResultError(result) {
  if (!result) return "Unknown send error.";

  return (
    result.error ||
    result.data?.error ||
    result.data?.message ||
    result.data?.detail ||
    `Send failed with status ${result.status || "unknown"}.`
  );
}

function getStepContentForMessageRow({ stepPayload, result, stepIndex }) {
  const resolved = String(result?.resolvedMessage || "").trim();
  if (resolved) return resolved;

  const raw = String(stepPayload?.message || "").trim();
  if (raw) return raw;

  if (stepPayload?.template?.name) {
    return `[WhatsApp template: ${stepPayload.template.name}]`;
  }

  if (stepPayload?.template?.projectId) {
    return `[WhatsApp template: ${stepPayload.template.projectId}]`;
  }

  if (stepPayload?.whatsappTemplateId) {
    return `[WhatsApp template id: ${stepPayload.whatsappTemplateId}]`;
  }

  return `[Read chain step ${stepIndex}]`;
}

function claimSkipResult(claim, stepIndex) {
  return {
    ok: true,
    sent: false,
    waitingForReply: false,
    skipped: true,
    kind: claim?.outcome || "not_claimed",
    stepIndex,
    deliveryStatus: claim?.delivery_status || null,
  };
}

async function markUnknownSafely({
  deliveryId,
  organizationId,
  claimToken,
  error,
  providerMessageId = null,
}) {
  try {
    return await markMessageChainDeliveryUnknownOutcome({
      deliveryId,
      organizationId,
      claimToken,
      lastError: error?.message || String(error),
      providerMessageId,
    });
  } catch (markError) {
    logger.error(
      "message_chain_delivery_state_failed",
      {
        provider: "supabase",
        operation: "delivery_unknown_outcome_update",
        outcome: "failed",
        deliveryId,
      },
      markError,
    );
    return null;
  }
}

export async function sendReadChainStep({
  chain,
  chainRecipient,
  chainStep,
  stepIndex,
  workerId = null,
  leaseSeconds = DEFAULT_LEASE_SECONDS,
  initialDeliveryStatus = "queued",
  dueAt = null,
}) {
  if (!chain?.id || !chain?.organization_id) {
    throw new Error("chain with organization_id is required");
  }

  if (!chainRecipient?.id || !chainRecipient?.user_id) {
    throw new Error("chainRecipient with user_id is required");
  }

  if (!chainStep?.id || !chainStep?.payload) {
    throw new Error("chainStep with payload is required");
  }

  const delivery = await ensureMessageChainDelivery({
    organizationId: chain.organization_id,
    chainId: chain.id,
    chainStepId: chainStep.id,
    chainRecipientId: chainRecipient.id,
    userId: chainRecipient.user_id,
    stepIndex,
    initialStatus: initialDeliveryStatus,
    dueAt,
  });

  const claim = await claimMessageChainDelivery({
    deliveryId: delivery.id,
    organizationId: chain.organization_id,
    chainId: chain.id,
    chainStepId: chainStep.id,
    chainRecipientId: chainRecipient.id,
    userId: chainRecipient.user_id,
    workerId: workerId || `read-chain-delivery-${crypto.randomUUID()}`,
    leaseSeconds,
  });

  if (!claim || claim.outcome !== "claimed") {
    return claimSkipResult(claim, stepIndex);
  }

  const claimToken = claim.claim_token;
  const stepPayload = chainStep.payload || {};
  let sendStarted = false;
  let providerMessageId = null;

  try {
    return await withLeaseHeartbeat(
      {
        label: "message chain delivery",
        leaseSeconds,
        renew: () =>
          renewMessageChainDeliveryLease({
            deliveryId: delivery.id,
            organizationId: chain.organization_id,
            claimToken,
            leaseSeconds,
          }),
      },
      async (heartbeat) => {
        heartbeat.assertOwned();
        const started = await markMessageChainDeliverySendStarted({
          deliveryId: delivery.id,
          organizationId: chain.organization_id,
          claimToken,
        });

        if (!started) {
          const error = new Error(
            "Message chain delivery claim was lost before send",
          );
          error.claimLost = true;
          throw error;
        }

        sendStarted = true;
        heartbeat.assertOwned();

        const result = await sendWhatsappBroadcast({
          orgId: chain.organization_id,
          message: stepPayload.message || "",
          files: Array.isArray(stepPayload.files) ? stepPayload.files : [],
          imageUrls: Array.isArray(stepPayload.imageUrls)
            ? stepPayload.imageUrls
            : [],
          recipients: [{ userId: chainRecipient.user_id }],
          template: stepPayload.template || null,
          whatsappTemplateId: stepPayload.whatsappTemplateId || null,
          trackedLinks: Array.isArray(stepPayload.trackedLinks)
            ? stepPayload.trackedLinks
            : [],
          scheduledBroadcastId: null,
          sendGroupId: `${chain.id}-step-${stepIndex}`,
          createdByUserId: chain.created_by_user_id || null,
          chainMetadata: {
            messageChainId: chain.id,
            messageChainStepId: chainStep.id,
            messageChainRecipientId: chainRecipient.id,
            messageChainStepIndex: stepIndex,
          },
        });

        const recipientResult = Array.isArray(result?.results)
          ? result.results[0]
          : null;
        providerMessageId = recipientResult?.providerMessageId || null;

        if (!recipientResult?.ok) {
          const errorMessage = getResultError(recipientResult);
          const failed = await failMessageChainDeliveryAfterSend({
            deliveryId: delivery.id,
            organizationId: chain.organization_id,
            claimToken,
            lastError: errorMessage,
            providerMessageId,
          });

          if (!failed) {
            const error = new Error(
              "Message chain delivery claim was lost after provider rejection",
            );
            error.claimLost = true;
            throw error;
          }

          return {
            ok: false,
            sent: false,
            waitingForReply: false,
            kind: recipientResult?.kind || "failed",
            stepIndex,
            error: errorMessage,
            result: recipientResult,
          };
        }

        if (recipientResult.kind === "template") {
          const messageRow = await createMessage({
            threadId: null,
            userId: chainRecipient.user_id,
            organizationId: chain.organization_id,
            assistantId: null,
            channel: "whatsapp",
            messageId: providerMessageId,
            externalContactId:
              recipientResult.birdContactId ||
              recipientResult.whatsappBsuid ||
              recipientResult.to ||
              null,
            content: getStepContentForMessageRow({
              stepPayload,
              result: recipientResult,
              stepIndex,
            }),
            role: "assistant",
            deliveryStatus: "sent",
            scheduledBroadcastId: null,
            automationRunId: null,
            messageChainId: chain.id,
            messageChainStepId: chainStep.id,
            messageChainRecipientId: chainRecipient.id,
            messageChainStepIndex: stepIndex,
          });
          const completed = await completeMessageChainDeliverySend({
            deliveryId: delivery.id,
            organizationId: chain.organization_id,
            claimToken,
            messageId: messageRow.id,
            providerMessageId,
          });

          if (!completed) {
            const error = new Error(
              "Message chain delivery claim was lost after template send",
            );
            error.claimLost = true;
            throw error;
          }

          return {
            ok: true,
            sent: false,
            waitingForReply: true,
            kind: "template",
            stepIndex,
            providerMessageId,
            delivery: completed,
            result: recipientResult,
            warning:
              "Window was closed. Fallback template was sent and the chain step is waiting for user reply.",
          };
        }

        if (recipientResult.kind !== "freeform") {
          const errorMessage = `Unexpected WhatsApp send result kind: ${
            recipientResult.kind || "unknown"
          }.`;
          const failed = await failMessageChainDeliveryAfterSend({
            deliveryId: delivery.id,
            organizationId: chain.organization_id,
            claimToken,
            lastError: errorMessage,
            providerMessageId,
          });

          if (!failed) {
            const error = new Error(
              "Message chain delivery claim was lost after provider response",
            );
            error.claimLost = true;
            throw error;
          }

          return {
            ok: false,
            sent: false,
            waitingForReply: false,
            kind: recipientResult.kind || "unknown",
            stepIndex,
            error: errorMessage,
            result: recipientResult,
          };
        }

        const messageRow = await createMessage({
          threadId: null,
          userId: chainRecipient.user_id,
          organizationId: chain.organization_id,
          assistantId: null,
          channel: "whatsapp",
          messageId: providerMessageId,
          externalContactId:
            recipientResult.birdContactId ||
            recipientResult.whatsappBsuid ||
            recipientResult.to ||
            null,
          content: getStepContentForMessageRow({
            stepPayload,
            result: recipientResult,
            stepIndex,
          }),
          role: "assistant",
          deliveryStatus: "sent",
          scheduledBroadcastId: null,
          automationRunId: null,
          messageChainId: chain.id,
          messageChainStepId: chainStep.id,
          messageChainRecipientId: chainRecipient.id,
          messageChainStepIndex: stepIndex,
        });

        heartbeat.assertOwned();
        const completed = await completeMessageChainDeliverySend({
          deliveryId: delivery.id,
          organizationId: chain.organization_id,
          claimToken,
          messageId: messageRow.id,
          providerMessageId,
        });

        if (!completed) {
          const error = new Error(
            "Message chain delivery claim was lost before completion",
          );
          error.claimLost = true;
          throw error;
        }

        return {
          ok: true,
          sent: true,
          waitingForReply: false,
          kind: "freeform",
          stepIndex,
          message: messageRow,
          delivery: completed,
          result: recipientResult,
          warning: providerMessageId
            ? null
            : "No provider message id was returned. Read tracking may not advance.",
        };
      },
    );
  } catch (error) {
    if (!sendStarted) {
      await failMessageChainDeliveryBeforeSend({
        deliveryId: delivery.id,
        organizationId: chain.organization_id,
        claimToken,
        lastError: error?.message || String(error),
      });
      throw error;
    }

    const unknown = await markUnknownSafely({
      deliveryId: delivery.id,
      organizationId: chain.organization_id,
      claimToken,
      error,
      providerMessageId,
    });

    return {
      ok: false,
      sent: false,
      waitingForReply: false,
      kind: "unknown_outcome",
      stepIndex,
      delivery: unknown,
      error: error?.message || String(error),
      unknownOutcome: true,
    };
  }
}
