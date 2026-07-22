/* --------------------
WhatsApp inbound webhook + read receipt webhook
----------------------*/
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { logger } from "@/lib/observability/logger";

import {
  getUserByNumber,
  getUserByWhatsappBsuid,
  getUserByBirdContactId,
  updateUserWhatsappIdentity,
} from "@/lib/repos/user.repo";
import {
  createThread,
  getUserThreadForChannel,
} from "@/lib/repos/threads.repo";
import {
  getAssistantById,
  getAssistantsInOrg,
} from "@/lib/repos/assistants.repo";
import { createOAiThread, sendMessageToAi } from "@/lib/services/oAi.services";
import {
  getOrganization,
  getOrganizationByChannelId,
} from "@/lib/repos/organizations.repo";
import {
  createMessage,
  markMessageReadByProviderId,
} from "@/lib/repos/messages.repo";
import {
  claimPendingOutreachForReply,
  markPendingOutreachSendStarted,
  renewPendingOutreachForWebhook,
  transitionPendingOutreachForWebhook,
} from "@/lib/repos/pendingOutreach.repo";
import {
  createMessageChainDelivery,
  getValidatedMessageChainContext,
  updateMessageChainRecipientProgress,
} from "@/lib/repos/messageChain.repo";
import { splitE164 } from "@/lib/whatsapp/E164";
import { processReadChainAfterRead } from "@/lib/services/broadcast/readChains/processReadChainAfterRead";
import { assertAssistantBelongsToOrg } from "@/lib/auth/guards";
import { getSupabaseAdminClient } from "@/lib/db/admin";
import { registerWebhookEvent } from "@/lib/repos/webhookEvents.repo";
import {
  buildMessageBirdEventIdentity,
  getMessageBirdChannelId,
} from "@/lib/webhooks/eventIdentity";
import { runWebhookEffect } from "@/lib/webhooks/effectRunner";
import { getOrCreateReservedThread } from "@/lib/webhooks/conversationReservation";
import { startLeaseHeartbeat } from "@/lib/webhooks/leaseHeartbeat";

const SIGNING_KEY = process.env.MESSAGEBIRD_SIGNING_KEY;

function normalizeId(value) {
  if (value === undefined || value === null) return null;

  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

function normalizeUsername(value) {
  const str = normalizeId(value);
  return str ? str.toLowerCase() : null;
}

function normalizePhone(value) {
  const raw = normalizeId(value);
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return null;

  return raw;
}

function extractBirdMessageId(data) {
  return (
    data?.id ||
    data?.message?.id ||
    data?.payload?.id ||
    data?.result?.id ||
    data?.results?.[0]?.id ||
    data?.messages?.[0]?.id ||
    null
  );
}

function safePayload(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function getThreadAiThreadId(thread) {
  if (!thread) return null;

  return (
    normalizeId(thread.ai_thread_id) ||
    normalizeId(thread.aiThreadId) ||
    normalizeId(thread.ai_threadId) ||
    normalizeId(thread.open_ai_thread_id) ||
    normalizeId(thread.openAiThreadId) ||
    normalizeId(thread.openai_thread_id) ||
    null
  );
}

function getAssistantOpenAiId(assistant) {
  if (!assistant) return null;

  return (
    normalizeId(assistant.open_ai_id) ||
    normalizeId(assistant.openAiId) ||
    normalizeId(assistant.openai_id) ||
    null
  );
}

function getAiResponseText(response) {
  if (typeof response === "string") {
    return response;
  }

  if (!response) return "";

  return String(
    response.aiResponse ??
      response.text ??
      response.message ??
      response.content ??
      "",
  );
}

function isFreshTimestamp(timestamp, toleranceSeconds = 300) {
  const numericTimestamp = Number(timestamp);

  if (!Number.isFinite(numericTimestamp)) {
    return false;
  }

  const timestampMs =
    numericTimestamp > 1e12 ? numericTimestamp : numericTimestamp * 1000;

  return Math.abs(Date.now() - timestampMs) <= toleranceSeconds * 1000;
}

function isValid(sigB64, ts, fullUrl, raw) {
  if (!SIGNING_KEY || !sigB64 || !ts || !fullUrl) return false;

  const bodyHash = crypto.createHash("sha256").update(raw).digest();

  const payload = Buffer.concat([Buffer.from(`${ts}\n${fullUrl}\n`), bodyHash]);

  const expected = crypto
    .createHmac("sha256", SIGNING_KEY)
    .update(payload)
    .digest();

  const received = Buffer.from(sigB64, "base64");

  if (received.length !== expected.length) return false;

  return crypto.timingSafeEqual(expected, received);
}

function getIdentifier(contact, key) {
  const cleanKey = String(key || "").toLowerCase();

  return (
    (contact?.identifiers || []).find(
      (x) => String(x?.identifierKey || "").toLowerCase() === cleanKey,
    )?.identifierValue || null
  );
}

function getPortfolioScopedBsuid(contact) {
  return (
    (contact?.identifiers || []).find((x) =>
      String(x?.identifierKey || "")
        .toLowerCase()
        .startsWith("whatsapp_"),
    )?.identifierValue || null
  );
}

function extractWhatsappIdentity(payload) {
  const sender = payload?.sender || {};
  const senderContact = sender?.contact || {};
  const extra = payload?.meta?.extraInformation || {};

  const contactId =
    normalizeId(senderContact.id) || normalizeId(payload?.contact?.id) || null;

  const senderKey = String(
    senderContact.identifierKey || sender.identifierKey || "",
  ).toLowerCase();

  const senderValue =
    normalizeId(senderContact.identifierValue) ||
    normalizeId(sender.identifierValue) ||
    null;

  const phoneNumber =
    normalizePhone(extra.phoneNumber) ||
    normalizePhone(extra.phone_number) ||
    normalizePhone(getIdentifier(senderContact, "phonenumber")) ||
    (senderKey === "phonenumber" ? normalizePhone(senderValue) : null);

  const whatsappBsuid =
    normalizeId(extra.whatsappbsuid) ||
    normalizeId(extra.whatsappBsuid) ||
    normalizeId(getIdentifier(senderContact, "whatsappbsuid")) ||
    normalizeId(getPortfolioScopedBsuid(senderContact));

  const whatsappUsername =
    normalizeUsername(extra.whatsappusername) ||
    normalizeUsername(extra.whatsappUsername) ||
    normalizeUsername(getIdentifier(senderContact, "whatsappusername")) ||
    (senderKey === "whatsappusername" ? normalizeUsername(senderValue) : null);

  return {
    phoneNumber,
    whatsappBsuid,
    whatsappUsername,
    birdContactId: contactId,
  };
}

function extractReadInteraction(evt) {
  const payload = evt?.payload || {};

  const isReadInteraction =
    evt?.service === "channels" &&
    evt?.event === "whatsapp.interaction" &&
    payload?.type === "read";

  if (!isReadInteraction) return null;

  return {
    messageId: normalizeId(payload.messageId),
    channelId: normalizeId(payload.channelId),
    readAt:
      normalizeId(payload.createdAt) ||
      normalizeId(payload.updatedAt) ||
      new Date().toISOString(),
  };
}

async function handleReadInteraction(readInteraction, webhookContext = null) {
  if (!readInteraction.messageId) {
    logger.warn("read_interaction_invalid", {
      provider: "bird",
      operation: "read_interaction",
      outcome: "missing_message_id",
    });

    return;
  }

  if (!readInteraction.channelId) {
    logger.warn("read_interaction_invalid", {
      provider: "bird",
      operation: "read_interaction",
      outcome: "missing_channel_id",
    });

    return;
  }

  let organization;

  try {
    organization = await getOrganizationByChannelId(readInteraction.channelId);
  } catch (err) {
    logger.error(
      "organization_resolution_failed",
      {
        provider: "supabase",
        operation: "read_interaction_organization_lookup",
        outcome: "failed",
      },
      err,
    );

    throw new Error("Could not resolve read receipt organization");
  }

  if (!organization) {
    logger.warn("organization_not_found", {
      provider: "supabase",
      operation: "read_interaction_organization_lookup",
      outcome: "not_found",
    });

    return;
  }

  const updated = await runWebhookEffect({
    context: webhookContext,
    effectType: "persist_read_receipt",
    effectKey: "message-read",
    request: {
      messageId: readInteraction.messageId,
      organizationId: organization.id,
      readAt: readInteraction.readAt,
    },
    operation: () =>
      markMessageReadByProviderId(
        readInteraction.messageId,
        readInteraction.readAt,
        organization.id,
      ),
  });

  if (!updated) {
    logger.warn("read_interaction_unmatched", {
      provider: "supabase",
      operation: "read_receipt_update",
      outcome: "not_found",
      organizationId: organization.id,
    });

    return;
  }

  if (Number(updated.organization_id) !== Number(organization.id)) {
    throw new Error(
      "Read receipt message does not belong to channel organization",
    );
  }

  if (!updated.message_chain_id) {
    return;
  }

  try {
    const chainResult = await runWebhookEffect({
      context: webhookContext,
      effectType: "read_chain_processing",
      effectKey: `advance-chain:${updated.message_chain_recipient_id}:${updated.message_chain_step_index}`,
      isExternal: true,
      request: {
        messageId: readInteraction.messageId,
        messageDbId: updated.id,
        chainId: updated.message_chain_id,
        chainRecipientId: updated.message_chain_recipient_id,
        chainStepId: updated.message_chain_step_id,
        stepIndex: updated.message_chain_step_index,
      },
      operation: () => processReadChainAfterRead(updated),
      classifyResult: (result) =>
        result?.sendResult?.unknownOutcome
          ? {
              status: "unknown_outcome",
              lastError:
                result.sendResult.error ||
                "Message chain delivery outcome is unknown",
            }
          : { status: "succeeded" },
    });

    logger.info("read_chain_processed", {
      provider: "internal",
      operation: "read_interaction_chain_advance",
      outcome: "completed",
      chainId: updated.message_chain_id,
      stepIndex: updated.message_chain_step_index,
    });
  } catch (err) {
    logger.error(
      "read_chain_processing_failed",
      {
        provider: "internal",
        operation: "read_interaction_chain_advance",
        outcome: "failed",
        chainId: updated.message_chain_id,
        stepIndex: updated.message_chain_step_index,
      },
      err,
    );

    throw err;
  }
}

async function findUserFromPhone(rawPhone, organizationId) {
  if (!organizationId) {
    return null;
  }

  const digits = String(rawPhone || "").replace(/\D/g, "");
  const { nationalNumber } = splitE164(rawPhone || "");

  let user = null;

  if (nationalNumber) {
    user = await getUserByNumber(nationalNumber, organizationId);
  }

  if (!user && digits) {
    user = await getUserByNumber(digits, organizationId);
  }

  return user;
}

async function findUserFromWhatsappIdentity(identity, organizationId) {
  if (!organizationId) {
    return null;
  }

  if (identity.whatsappBsuid) {
    const user = await getUserByWhatsappBsuid(
      identity.whatsappBsuid,
      organizationId,
    );

    if (user) return user;
  }

  if (identity.birdContactId) {
    const user = await getUserByBirdContactId(
      identity.birdContactId,
      organizationId,
    );

    if (user) return user;
  }

  if (identity.phoneNumber) {
    return await findUserFromPhone(identity.phoneNumber, organizationId);
  }

  return null;
}

function buildReceiverContact({ contactId, phoneNumber, whatsappBsuid }) {
  if (contactId) {
    return { id: contactId };
  }

  if (phoneNumber) {
    return {
      identifierKey: "phonenumber",
      identifierValue: phoneNumber,
    };
  }

  if (whatsappBsuid) {
    return {
      identifierKey: "whatsappbsuid",
      identifierValue: whatsappBsuid,
    };
  }

  return null;
}

async function sendBirdMessage({
  channelId,
  contactId,
  phoneNumber,
  whatsappBsuid,
  body,
}) {
  const cleanChannelId = normalizeId(channelId);
  const receiverContact = buildReceiverContact({
    contactId: normalizeId(contactId),
    phoneNumber: normalizeId(phoneNumber),
    whatsappBsuid: normalizeId(whatsappBsuid),
  });

  if (!cleanChannelId) {
    return {
      ok: false,
      status: 400,
      data: { error: "Missing MessageBird/Bird channelId" },
      providerMessageId: null,
    };
  }

  if (!receiverContact) {
    return {
      ok: false,
      status: 400,
      data: { error: "Missing MessageBird/Bird contactId" },
      providerMessageId: null,
    };
  }

  if (!process.env.WORKSPACE_ID) {
    return {
      ok: false,
      status: 500,
      data: { error: "Missing WORKSPACE_ID env variable" },
      providerMessageId: null,
    };
  }

  if (!process.env.BIRD_API_KEY) {
    return {
      ok: false,
      status: 500,
      data: { error: "Missing BIRD_API_KEY env variable" },
      providerMessageId: null,
    };
  }

  let res;

  try {
    res = await fetch(
      `https://api.bird.com/workspaces/${process.env.WORKSPACE_ID}/channels/${cleanChannelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `AccessKey ${process.env.BIRD_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiver: {
            contacts: [receiverContact],
          },
          body,
        }),
      },
    );
  } catch (err) {
    return {
      ok: false,
      status: 500,
      outcome: "unknown",
      data: {
        error: "Failed to call Bird API",
        message: err?.message || String(err),
      },
      providerMessageId: null,
    };
  }

  const raw = await res.text();
  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }

  return {
    ok: res.ok,
    status: res.status,
    outcome: res.ok ? "accepted" : "rejected",
    data,
    providerMessageId: extractBirdMessageId(data),
  };
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "messagebird" });
}

function isSupportedMessageBirdEvent(event) {
  return Boolean(
    (event?.service === "channels" &&
      event?.event === "whatsapp.inbound" &&
      event?.payload?.body?.type === "text") ||
    (event?.service === "channels" &&
      event?.event === "whatsapp.interaction" &&
      event?.payload?.type === "read"),
  );
}

function registrationResponse(registration) {
  if (registration.outcome === "payload_conflict") {
    logger.error("webhook_identity_conflict", {
      provider: "bird",
      operation: "webhook_registration",
      outcome: "payload_conflict",
      status: registration.status,
    });
    return NextResponse.json(
      { ok: false, error: "Webhook identity conflict" },
      { status: 409 },
    );
  }

  if (
    registration.outcome === "duplicate_succeeded" ||
    registration.outcome === "duplicate_processing"
  ) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      status: registration.status,
    });
  }

  return NextResponse.json(
    {
      ok: true,
      accepted: true,
      status: registration.status,
    },
    { status: 202 },
  );
}

function throwForProviderResult(result, providerName) {
  if (result?.ok) return result;

  const error = new Error(
    `${providerName} did not accept the requested outbound message`,
  );
  error.webhookState =
    result?.outcome === "unknown"
      ? "unknown_outcome"
      : Number(result?.status || 0) >= 500
        ? "retryable_failed"
        : "failed";
  throw error;
}

export async function POST(req) {
  const rawBody = await req.text();

  const sigHeader = req.headers.get("messagebird-signature") ?? "";

  const tsHeader = req.headers.get("messagebird-request-timestamp") ?? "";

  if (!isFreshTimestamp(tsHeader)) {
    logger.warn("webhook_validation_failed", {
      provider: "bird",
      operation: "timestamp_validation",
      outcome: "rejected",
    });

    return new NextResponse("invalid timestamp", {
      status: 401,
    });
  }

  const proto = req.headers.get("x-forwarded-proto") || "https";

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");

  if (!host) {
    logger.warn("webhook_validation_failed", {
      provider: "bird",
      operation: "host_validation",
      outcome: "rejected",
    });

    return new NextResponse("invalid webhook URL", {
      status: 401,
    });
  }

  const fullUrl = `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`;

  const ok = isValid(sigHeader, tsHeader, fullUrl, rawBody);

  if (!ok) {
    logger.warn("webhook_validation_failed", {
      provider: "bird",
      operation: "signature_validation",
      outcome: "rejected",
    });

    return new NextResponse("invalid signature", {
      status: 401,
    });
  }

  try {
    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!isSupportedMessageBirdEvent(event)) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const channelId = getMessageBirdChannelId(event);
    if (!channelId) {
      return NextResponse.json(
        { error: "MessageBird event identity is incomplete" },
        { status: 400 },
      );
    }

    const organization = await getOrganizationByChannelId(channelId);
    if (!organization) {
      return NextResponse.json(
        { error: "MessageBird channel organization was not found" },
        { status: 404 },
      );
    }

    const identity = buildMessageBirdEventIdentity(event, organization.id);
    if (!identity) {
      return NextResponse.json(
        { error: "MessageBird event identity is incomplete" },
        { status: 400 },
      );
    }

    const registration = await registerWebhookEvent(identity);
    return registrationResponse(registration);
  } catch (err) {
    logger.error(
      "webhook_processing_failed",
      {
        provider: "bird",
        operation: "webhook_registration",
        outcome: "failed",
        statusCode: err?.status,
      },
      err,
    );

    return NextResponse.json(
      { ok: false, error: "Webhook event was not accepted durably" },
      { status: 503 },
    );
  }
}

export async function processMessageBirdWebhookEvent(
  evt,
  webhookContext = null,
) {
  if (webhookContext?.eventId) {
    return runWebhookEffect({
      context: webhookContext,
      effectType: "messagebird_event_dispatch",
      effectKey: "dispatch",
      isExternal: true,
      request: evt,
      operation: () => processMessageBirdWebhookEventCore(evt, webhookContext),
    });
  }

  return processMessageBirdWebhookEventCore(evt, webhookContext);
}

async function processMessageBirdWebhookEventCore(evt, webhookContext = null) {
  const readInteraction = extractReadInteraction(evt);

  if (readInteraction) {
    await handleReadInteraction(readInteraction, webhookContext);
    return;
  }

  const isInboundText =
    evt.service === "channels" &&
    evt.event === "whatsapp.inbound" &&
    evt.payload?.body?.type === "text";

  if (!isInboundText) return;

  const identity = extractWhatsappIdentity(evt.payload);
  const contactId = identity.birdContactId;
  const text = evt.payload?.body?.text?.text || "";

  const sentChannelId =
    normalizeId(evt.payload?.channelId) ||
    normalizeId(evt.payload?.channel?.id) ||
    normalizeId(evt.payload?.receiver?.channel?.id);

  const inboundMsgId =
    normalizeId(evt.payload?.id) ||
    normalizeId(evt.payload?.messageId) ||
    normalizeId(evt.payload?.body?.id);

  if (!sentChannelId) {
    logger.warn("inbound_identity_missing", {
      provider: "bird",
      operation: "inbound_message",
      outcome: "missing_channel_id",
    });

    return;
  }

  if (!identity.phoneNumber && !identity.whatsappBsuid && !contactId) {
    logger.warn("inbound_identity_missing", {
      provider: "bird",
      operation: "inbound_message",
      outcome: "missing_user_identity",
    });

    return;
  }

  let channelOrganization;

  try {
    channelOrganization = await getOrganizationByChannelId(sentChannelId);
  } catch (err) {
    logger.error(
      "organization_resolution_failed",
      {
        provider: "supabase",
        operation: "webhook_organization_lookup",
        outcome: "failed",
      },
      err,
    );

    throw new Error("Could not resolve webhook organization");
  }

  if (!channelOrganization) {
    logger.warn("organization_not_found", {
      provider: "supabase",
      operation: "webhook_organization_lookup",
      outcome: "not_found",
    });

    return;
  }

  let user = await findUserFromWhatsappIdentity(
    identity,
    channelOrganization.id,
  );

  if (user && Number(user.organization_id) !== Number(channelOrganization.id)) {
    throw new Error("Webhook user does not belong to channel organization");
  }

  if (user) {
    user = await updateUserWhatsappIdentity(user.id, identity);
  }

  if (!user) {
    const response = await sendBirdMessage({
      channelId: sentChannelId,
      contactId,
      phoneNumber: identity.phoneNumber,
      whatsappBsuid: identity.whatsappBsuid,
      body: {
        type: "text",
        text: {
          text: "Este número não se encontra registado, por favor fale com os administradores.",
        },
      },
    });

    throwForProviderResult(response, "Bird");

    return;
  }

  const pendingMessage = webhookContext?.eventId
    ? await claimPendingOutreachForReply({
        organizationId: user.organization_id,
        userId: user.id,
        webhookEventId: webhookContext.eventId,
        eventClaimToken: webhookContext.claimToken,
        workerId: webhookContext.workerId,
        leaseSeconds: webhookContext.leaseSeconds || 120,
      })
    : null;

  if (pendingMessage) {
    await handlePendingMessages({
      user,
      inboundMsgId,
      contactId,
      inboundIdentity: identity,
      inboundText: text,
      pendingMessage,
      sentChannelId,
      webhookContext,
    });

    return;
  }

  const organization = await getOrganization(user.organization_id);

  if (!organization) {
    logger.warn("organization_not_found", {
      provider: "supabase",
      operation: "inbound_user_organization_lookup",
      outcome: "not_found",
      userId: user.id,
    });
    return;
  }

  if (Number(organization.id) !== Number(channelOrganization.id)) {
    throw new Error(
      "User organization does not match webhook channel organization",
    );
  }

  const assistantRow = await getAssistantFromUser(user, organization);

  if (!assistantRow) {
    logger.warn("assistant_not_found", {
      provider: "supabase",
      operation: "inbound_assistant_lookup",
      outcome: "not_found",
      organizationId: organization.id,
    });

    return;
  }

  const assistantOpenAiId = getAssistantOpenAiId(assistantRow);

  if (!assistantOpenAiId) {
    throw new Error(`Assistant ${assistantRow.id} is missing open_ai_id`);
  }

  const channel = "whatsapp";

  const existingThread = await getUserThreadForChannel({
    userId: user.id,
    assistantId: assistantRow.id,
    channel,
  });
  const thread = await getOrCreateReservedThread({
    context: webhookContext,
    userId: user.id,
    assistantId: assistantRow.id,
    channel,
    existingThread,
    createRemoteThread: async () => {
      const remote = await createOAiThread();
      if (!normalizeId(remote?.id)) {
        throw new Error("createOAiThread did not return an OpenAI thread id");
      }
      return remote;
    },
    createLocalThread: (remote) =>
      createThread({
        userId: user.id,
        assistantId: assistantRow.id,
        aiThreadId: normalizeId(remote?.id),
        channel,
        scope: "user",
        externalConversationId: null,
      }),
  });
  const aiThreadId = getThreadAiThreadId(thread);

  if (!aiThreadId) {
    throw new Error(
      `Existing thread ${thread?.id ?? "unknown"} is missing ai_thread_id`,
    );
  }

  await createMessage({
    threadId: thread?.id ?? null,
    userId: user.id,
    organizationId: user.organization_id,
    assistantId: assistantRow.id,
    channel,
    messageId: inboundMsgId,
    externalContactId: contactId,
    content: text,
    role: "user",
    webhookEventId: webhookContext?.eventId || null,
    webhookEffectKey: webhookContext?.eventId ? "dispatch:inbound" : null,
  });

  const aiResponse = await sendMessageToAi(assistantOpenAiId, text, aiThreadId);

  const aiText = getAiResponseText(aiResponse);

  if (!aiText.trim()) {
    throw new Error("OpenAI returned an empty assistant response");
  }

  let outboundId = null;

  const outgoingChannelId =
    normalizeId(organization.channel_id) || sentChannelId;

  const sendRes = await sendBirdMessage({
    channelId: outgoingChannelId,
    contactId,
    phoneNumber: identity.phoneNumber || user.phone_number,
    whatsappBsuid: identity.whatsappBsuid || user.whatsapp_bsuid,
    body: {
      type: "text",
      text: {
        text: aiText,
      },
    },
  });

  throwForProviderResult(sendRes, "Bird");
  outboundId = sendRes.providerMessageId;

  await createMessage({
    threadId: thread?.id ?? null,
    userId: user.id,
    organizationId: user.organization_id,
    assistantId: assistantRow.id,
    channel,
    messageId: outboundId,
    externalContactId: contactId,
    content: aiText,
    role: "assistant",
    deliveryStatus: sendRes.ok ? "accepted" : "failed",
    failedAt: sendRes.ok ? null : new Date().toISOString(),
    webhookEventId: webhookContext?.eventId || null,
    webhookEffectKey: webhookContext?.eventId ? "dispatch:outbound" : null,
  });
}

async function handlePendingMessages({
  user,
  inboundMsgId,
  contactId,
  inboundIdentity,
  inboundText,
  pendingMessage,
  sentChannelId,
  webhookContext = null,
}) {
  await createMessage({
    threadId: null,
    userId: user.id,
    organizationId: user.organization_id,
    assistantId: user.assistant_id ?? null,
    channel: "whatsapp",
    messageId: inboundMsgId,
    externalContactId: contactId,
    content: inboundText,
    role: "user",
    webhookEventId: webhookContext?.eventId || null,
    webhookEffectKey: webhookContext?.eventId
      ? "dispatch:pending-inbound"
      : null,
  });

  const organization = await getOrganization(user.organization_id);

  if (!organization) {
    logger.warn("organization_not_found", {
      provider: "supabase",
      operation: "pending_outreach_organization_lookup",
      outcome: "not_found",
      userId: user.id,
      organizationId: user.organization_id,
    });
    return;
  }

  const outgoingChannelId =
    normalizeId(organization.channel_id) || normalizeId(sentChannelId);

  const row = pendingMessage;
  const claimed = row;

  const processPending = async () => {
    const pendingHeartbeat = startLeaseHeartbeat({
      label: "pending outreach",
      leaseSeconds: webhookContext.leaseSeconds || 120,
      renew: () =>
        renewPendingOutreachForWebhook({
          id: row.id,
          organizationId: user.organization_id,
          userId: user.id,
          webhookEventId: webhookContext.eventId,
          eventClaimToken: webhookContext.claimToken,
          claimToken: claimed.claim_token,
          leaseSeconds: webhookContext.leaseSeconds || 120,
        }),
    });
    try {
      const p = safePayload(row.payload);

      const hasImages = Array.isArray(p.imageUrls) && p.imageUrls.length > 0;
      const hasText = Boolean(String(p.message || "").trim());

      if (!hasImages && !hasText) {
        logger.warn("pending_outreach_skipped", {
          provider: "internal",
          operation: "pending_outreach_send",
          outcome: "empty",
          pendingOutreachId: row.id,
          userId: user.id,
        });

        return;
      }

      const body = hasImages
        ? {
            type: "image",
            image: {
              images: p.imageUrls.map((u) => ({
                mediaUrl: u,
              })),
              ...(hasText ? { text: p.message } : {}),
            },
          }
        : {
            type: "text",
            text: {
              text: p.message || "",
            },
          };

      if (webhookContext?.eventId) {
        const marked = await markPendingOutreachSendStarted({
          id: row.id,
          organizationId: user.organization_id,
          userId: user.id,
          webhookEventId: webhookContext.eventId,
          eventClaimToken: webhookContext.claimToken,
          claimToken: claimed.claim_token,
        });
        if (!marked) {
          const error = new Error(
            "Pending outreach claim was lost before send",
          );
          error.webhookState = "retryable_failed";
          throw error;
        }
        pendingHeartbeat.assertOwned();
      }

      const sendRes = await sendBirdMessage({
        channelId: outgoingChannelId,
        contactId,
        phoneNumber: inboundIdentity?.phoneNumber || user.phone_number,
        whatsappBsuid: inboundIdentity?.whatsappBsuid || user.whatsapp_bsuid,
        body,
      });
      pendingHeartbeat?.assertOwned();

      if (!sendRes.ok) {
        const pendingStatus =
          sendRes.outcome === "unknown"
            ? "unknown_outcome"
            : Number(sendRes.status || 0) >= 500
              ? "retryable_failed"
              : "failed";
        let effectivePendingStatus = pendingStatus;
        if (webhookContext?.eventId) {
          const transitioned = await transitionPendingOutreachForWebhook({
            id: row.id,
            organizationId: user.organization_id,
            userId: user.id,
            webhookEventId: webhookContext.eventId,
            eventClaimToken: webhookContext.claimToken,
            claimToken: claimed.claim_token,
            status: pendingStatus,
            lastError: `Bird rejected pending outreach with status ${sendRes.status || "unknown"}`,
          });
          effectivePendingStatus = transitioned?.status || "unknown_outcome";
        }

        const error = new Error(
          "Bird did not accept the requested outbound message",
        );
        error.webhookState = effectivePendingStatus;
        if (effectivePendingStatus === "retryable_failed") {
          error.beforeExternalRequest = true;
        }
        throw error;
      }

      const outboundId = sendRes.providerMessageId;

      const hasChainMetadata =
        row.message_chain_id &&
        row.message_chain_step_id &&
        row.message_chain_recipient_id &&
        row.message_chain_step_index;

      const chainContext = hasChainMetadata
        ? await getValidatedMessageChainContext({
            chainId: row.message_chain_id,
            chainStepId: row.message_chain_step_id,
            chainRecipientId: row.message_chain_recipient_id,
            stepIndex: Number(row.message_chain_step_index),
            userId: user.id,
            organizationId: user.organization_id,
          })
        : null;

      await createMessage({
        threadId: null,
        userId: user.id,
        organizationId: user.organization_id,
        assistantId: user.assistant_id ?? null,
        channel: "whatsapp",
        messageId: outboundId,
        externalContactId: contactId,
        content: p.message || "",
        role: "assistant",
        deliveryStatus: "accepted",
        messageChainId: chainContext?.chain.id || null,
        messageChainStepId: chainContext?.step.id || null,
        messageChainRecipientId: chainContext?.recipient.id || null,
        messageChainStepIndex: chainContext
          ? Number(row.message_chain_step_index)
          : null,
        webhookEventId: webhookContext?.eventId || null,
        webhookEffectKey: webhookContext?.eventId
          ? `dispatch:pending-outbound:${row.id}`
          : null,
      });

      if (chainContext) {
        try {
          await createMessageChainDelivery({
            chainId: chainContext.chain.id,
            chainStepId: chainContext.step.id,
            chainRecipientId: chainContext.recipient.id,
            userId: user.id,
            stepIndex: Number(row.message_chain_step_index),
            providerMessageId: outboundId,
            status: "sent",
            sentAt: new Date().toISOString(),
          });

          await updateMessageChainRecipientProgress({
            chainId: chainContext.chain.id,
            chainRecipientId: chainContext.recipient.id,
            userId: user.id,
            currentStepIndex: Number(row.message_chain_step_index),
            status: "active",
          });

          logger.info("pending_outreach_chain_state_updated", {
            provider: "supabase",
            operation: "pending_outreach_chain_update",
            outcome: "succeeded",
            pendingOutreachId: row.id,
            chainId: row.message_chain_id,
            stepIndex: row.message_chain_step_index,
          });
        } catch (err) {
          logger.error(
            "pending_outreach_chain_state_failed",
            {
              provider: "supabase",
              operation: "pending_outreach_chain_update",
              outcome: "failed",
              pendingOutreachId: row.id,
              chainId: row.message_chain_id,
              stepIndex: row.message_chain_step_index,
            },
            err,
          );
        }
      }

      if (webhookContext?.eventId) {
        const transitioned = await transitionPendingOutreachForWebhook({
          id: row.id,
          organizationId: user.organization_id,
          userId: user.id,
          webhookEventId: webhookContext.eventId,
          eventClaimToken: webhookContext.claimToken,
          claimToken: claimed.claim_token,
          status: "replied",
          replyMessageId: inboundMsgId,
        });

        if (!transitioned) {
          const error = new Error("Pending outreach claim was lost");
          error.webhookState = "retryable_failed";
          throw error;
        }
      }
    } finally {
      await pendingHeartbeat?.stop();
    }
  };

  return runWebhookEffect({
    context: webhookContext,
    effectType: "pending_outreach_reply",
    effectKey: `pending-outreach:${row.id}`,
    isExternal: true,
    request: {
      pendingOutreachId: row.id,
      inboundMessageId: inboundMsgId,
    },
    operation: processPending,
  });
}

async function getAssistantFromUser(user, organization) {
  const admin = getSupabaseAdminClient();

  if (user.assistant_id) {
    await assertAssistantBelongsToOrg(
      admin,
      organization.id,
      user.assistant_id,
    );

    const assistant = await getAssistantById(user.assistant_id);
    if (assistant) return assistant;
  }

  const assistants = await getAssistantsInOrg(organization.id);

  if (!assistants?.length) return null;

  return assistants[0];
}
