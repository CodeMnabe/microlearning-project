/**
 * Service de criação de Read Chains.
 *
 * Valida e normaliza o pedido, confirma a feature da organização, cria a
 * chain e inicia ou agenda o primeiro step. Não devolve NextResponse.
 */

import { isReadChainsEnabled } from "@/lib/repos/broadcast/organizationMessagingFeature.repo";
import {
  createMessageChain,
  createMessageChainRecipients,
  createMessageChainSteps,
} from "@/lib/repos/broadcast/messageChain.repo";
import { BroadcastError } from "../shared";
import { sendReadChainStep } from "./sendReadChainStep";
import {
  findEmptyReadChainStepIndex,
  hasFallbackTemplate,
  normalizeReadChainRecipients,
  normalizeReadChainSteps,
  parseReadChainScheduledFor,
} from "./readChain.helpers";

function buildScheduledResult({
  chain,
  chainRecipients,
  stepCount,
  scheduledFor,
  timezone,
}) {
  return {
    ok: chainRecipients.length,
    failed: 0,
    sent: 0,
    waitingForReply: 0,
    scheduled: true,
    chainId: chain.id,
    recipientCount: chainRecipients.length,
    stepCount,
    scheduledFor,
    timezone: timezone || null,
    results: chainRecipients.map((chainRecipient) => ({
      userId: chainRecipient.user_id,
      ok: true,
      sent: false,
      scheduled: true,
      waitingForReply: false,
      kind: "scheduled",
      stepIndex: 1,
      error: null,
      warning: null,
    })),
    note:
      "Read chain scheduled. Message 1 will be sent at the scheduled time, then the next messages will continue after read receipts.",
  };
}

async function sendFirstReadChainStep({ chain, chainRecipients, firstStep }) {
  const results = [];

  for (const chainRecipient of chainRecipients) {
    try {
      const sendResult = await sendReadChainStep({
        chain,
        chainRecipient,
        chainStep: firstStep,
        stepIndex: 1,
      });

      results.push({
        userId: chainRecipient.user_id,
        ok: sendResult.ok,
        sent: Boolean(sendResult.sent),
        waitingForReply: Boolean(sendResult.waitingForReply),
        kind: sendResult.kind || null,
        stepIndex: 1,
        error: sendResult.error || null,
        warning: sendResult.warning || null,
      });
    } catch (error) {
      results.push({
        userId: chainRecipient.user_id,
        ok: false,
        sent: false,
        waitingForReply: false,
        kind: "error",
        stepIndex: 1,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Cria uma read chain e, quando não agendada, envia o primeiro step.
 * O resultado preserva o formato devolvido anteriormente pela API route.
 */
export async function createReadChain(input = {}) {
  const {
    orgId,
    createdByUserId = null,
    channel = "whatsapp",
    recipients: rawRecipients = [],
    steps: rawSteps = [],
    fallbackTemplate = null,
    fallbackWhatsappTemplateId = null,
    scheduledFor = null,
    timezone = null,
  } = input;

  if (!orgId) {
    throw new BroadcastError("Missing orgId", 400);
  }

  if (channel !== "whatsapp") {
    throw new BroadcastError("Read chains currently only support WhatsApp.", 400);
  }

  let scheduledForIso;
  try {
    scheduledForIso = parseReadChainScheduledFor(scheduledFor);
  } catch (error) {
    throw new BroadcastError(error.message, 400);
  }

  const isScheduled = Boolean(scheduledForIso);

  if (isScheduled && new Date(scheduledForIso).getTime() <= Date.now()) {
    throw new BroadcastError("scheduledFor must be in the future.", 400);
  }

  const enabled = await isReadChainsEnabled({ organizationId: orgId, channel });

  if (!enabled) {
    throw new BroadcastError(
      "Read chains are disabled for this organization.",
      403
    );
  }

  const recipients = normalizeReadChainRecipients(rawRecipients);

  if (recipients.length === 0) {
    throw new BroadcastError("At least one recipient with userId is required.", 400);
  }

  if (
    !hasFallbackTemplate({
      fallbackTemplate,
      fallbackWhatsappTemplateId,
      steps: rawSteps,
    })
  ) {
    throw new BroadcastError(
      "A fallback WhatsApp template is required for read chains, so the system can reopen the conversation window when needed.",
      400
    );
  }

  const steps = normalizeReadChainSteps(
    rawSteps,
    fallbackTemplate,
    fallbackWhatsappTemplateId
  );

  if (steps.length < 2 || steps.length > 10) {
    throw new BroadcastError(
      "A read chain must have between 2 and 10 messages.",
      400
    );
  }

  const emptyStepIndex = findEmptyReadChainStepIndex(steps);

  if (emptyStepIndex !== -1) {
    throw new BroadcastError(
      `Message ${emptyStepIndex + 1} is empty. Add text, files, or images. The fallback template does not count as the chain message content.`,
      400
    );
  }

  const chain = await createMessageChain({
    organizationId: orgId,
    createdByUserId,
    channel,
    status: isScheduled ? "scheduled" : "active",
    scheduledFor: scheduledForIso,
    timezone: timezone || null,
    recipientCount: recipients.length,
  });

  const chainSteps = await createMessageChainSteps({ chainId: chain.id, steps });
  const chainRecipients = await createMessageChainRecipients({
    chainId: chain.id,
    recipients,
  });
  const firstStep = chainSteps.find((step) => Number(step.step_index) === 1);

  if (!firstStep) {
    throw new BroadcastError("Could not create first chain step.", 500);
  }

  if (isScheduled) {
    return buildScheduledResult({
      chain,
      chainRecipients,
      stepCount: steps.length,
      scheduledFor: scheduledForIso,
      timezone,
    });
  }

  const results = await sendFirstReadChainStep({
    chain,
    chainRecipients,
    firstStep,
  });
  const okCount = results.filter((result) => result.ok).length;
  const failedCount = results.length - okCount;
  const sentCount = results.filter((result) => result.sent).length;
  const waitingCount = results.filter((result) => result.waitingForReply).length;

  return {
    ok: okCount,
    failed: failedCount,
    sent: sentCount,
    waitingForReply: waitingCount,
    scheduled: false,
    chainId: chain.id,
    recipientCount: recipients.length,
    stepCount: steps.length,
    results,
    error:
      okCount === 0
        ? results[0]?.error || "Read chain failed for all recipients."
        : null,
    note:
      waitingCount > 0
        ? "Some recipients had a closed WhatsApp window. The fallback template was sent and the chain step is waiting for their reply."
        : null,
  };
}
