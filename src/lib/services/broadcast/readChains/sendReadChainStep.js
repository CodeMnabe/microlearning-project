import { sendWhatsappBroadcast } from "@/lib/services/broadcast/sendWhatsappBroadcast";
import { createMessage } from "@/lib/repos/messages.repo";
import {
  createMessageChainDelivery,
  markMessageChainDeliveryFailed,
  updateMessageChainRecipientProgress,
} from "@/lib/repos/messageChain.repo";

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

export async function sendReadChainStep({
  chain,
  chainRecipient,
  chainStep,
  stepIndex,
}) {
  if (!chain?.id) {
    throw new Error("chain is required");
  }

  if (!chainRecipient?.id || !chainRecipient?.user_id) {
    throw new Error("chainRecipient with user_id is required");
  }

  if (!chainStep?.id || !chainStep?.payload) {
    throw new Error("chainStep with payload is required");
  }

  const stepPayload = chainStep.payload || {};

  const result = await sendWhatsappBroadcast({
    orgId: chain.organization_id,
    message: stepPayload.message || "",
    files: Array.isArray(stepPayload.files) ? stepPayload.files : [],
    imageUrls: Array.isArray(stepPayload.imageUrls)
      ? stepPayload.imageUrls
      : [],
    recipients: [
      {
        userId: chainRecipient.user_id,
      },
    ],
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

  if (!recipientResult?.ok) {
    const errorMessage = getResultError(recipientResult);

    await createMessageChainDelivery({
      chainId: chain.id,
      chainStepId: chainStep.id,
      chainRecipientId: chainRecipient.id,
      userId: chainRecipient.user_id,
      messageDbId: null,
      providerMessageId: recipientResult?.providerMessageId || null,
      stepIndex,
      status: "failed",
      sentAt: null,
      failedAt: new Date(),
      errorMessage,
    });

    await markMessageChainDeliveryFailed({
      chainRecipientId: chainRecipient.id,
      stepIndex,
      errorMessage,
    });

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
    return {
      ok: true,
      sent: false,
      waitingForReply: true,
      kind: "template",
      stepIndex,
      providerMessageId: recipientResult.providerMessageId || null,
      result: recipientResult,
      warning:
        "Window was closed. Fallback template was sent and the chain step is waiting for user reply.",
    };
  }

  if (recipientResult.kind !== "freeform") {
    const errorMessage = `Unexpected WhatsApp send result kind: ${
      recipientResult.kind || "unknown"
    }.`;

    await createMessageChainDelivery({
      chainId: chain.id,
      chainStepId: chainStep.id,
      chainRecipientId: chainRecipient.id,
      userId: chainRecipient.user_id,
      messageDbId: null,
      providerMessageId: recipientResult.providerMessageId || null,
      stepIndex,
      status: "failed",
      sentAt: null,
      failedAt: new Date(),
      errorMessage,
    });

    await markMessageChainDeliveryFailed({
      chainRecipientId: chainRecipient.id,
      stepIndex,
      errorMessage,
    });

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

  const providerMessageId = recipientResult.providerMessageId || null;

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

  await createMessageChainDelivery({
    chainId: chain.id,
    chainStepId: chainStep.id,
    chainRecipientId: chainRecipient.id,
    userId: chainRecipient.user_id,
    messageDbId: messageRow.id,
    providerMessageId,
    stepIndex,
    status: "sent",
    sentAt: new Date(),
    errorMessage: providerMessageId
      ? null
      : "Message was sent, but no provider message id was returned. Read tracking may not advance.",
  });

  await updateMessageChainRecipientProgress({
    chainRecipientId: chainRecipient.id,
    currentStepIndex: stepIndex,
    status: "active",
  });

  return {
    ok: true,
    sent: true,
    waitingForReply: false,
    kind: "freeform",
    stepIndex,
    message: messageRow,
    result: recipientResult,
    warning: providerMessageId
      ? null
      : "No provider message id was returned. Read tracking may not advance.",
  };
}
