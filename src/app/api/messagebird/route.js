/* --------------------
WhatsApp inbound webhook + read receipt webhook
----------------------*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "crypto";

import {
  getUserByNumber,
  getUserByWhatsappBsuid,
  getUserByBirdContactId,
  updateUserWhatsappIdentity,
} from "@/lib/repos/user.repo";

import {
  createThread,
  getUserThreadForChannel,
  setThreadConversationId,
} from "@/lib/repos/threads.repo";

import {
  getAssistantById,
  getAssistantsInOrg,
} from "@/lib/repos/assistants.repo";

import {
  createConversation,
  generateAssistantResponse,
} from "@/lib/services/openaiResponses.service";

import {
  getOrganization,
  getOrganizationByChannelId,
} from "@/lib/repos/organizations.repo";

import {
  createMessage,
  getMessagesInThread,
  markMessageReadByProviderId,
} from "@/lib/repos/messages.repo";

import {
  getAllPendingOutreachByUser,
  markPendingOutreachReplied,
} from "@/lib/repos/pendingOutreach.repo";

import {
  createMessageChainDelivery,
  updateMessageChainRecipientProgress,
} from "@/lib/repos/messageChain.repo";

import { splitE164 } from "@/lib/whatsapp/E164";

import { processReadChainAfterRead } from "@/lib/services/broadcast/readChains/processReadChainAfterRead";

const SIGNING_KEY = process.env.MESSAGEBIRD_SIGNING_KEY;

/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function normalizeId(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const str = String(value).trim();

  return str.length > 0 ? str : null;
}

function normalizeUsername(value) {
  const str = normalizeId(value);

  return str ? str.toLowerCase() : null;
}

function normalizePhone(value) {
  const raw = normalizeId(value);

  if (!raw) {
    return null;
  }

  const digits = raw.replace(/\D/g, "");

  if (digits.length < 7) {
    return null;
  }

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
  if (!value) {
    return {};
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

/**
 * Convert messages stored in our DB into initial
 * OpenAI Conversation items.
 *
 * This is only used when migrating an EXISTING
 * Assistants API thread into a new Conversation.
 *
 * We use at most the latest 20 messages because
 * OpenAI Conversation creation accepts up to
 * 20 initial items.
 */
function buildConversationHistoryItems(messages = []) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message) => {
      const role = message?.role;
      const content = message?.content;

      return (
        (role === "user" || role === "assistant") &&
        typeof content === "string" &&
        content.trim()
      );
    })
    .slice(-20)
    .map((message) => ({
      type: "message",
      role: message.role,
      content: message.content.trim(),
    }));
}

/* =========================================================
   MESSAGEBIRD SIGNATURE
   ========================================================= */

function isValid(sigB64, ts, fullUrl, raw) {
  if (!SIGNING_KEY || !sigB64 || !ts || !fullUrl) {
    return false;
  }

  const bodyHash = crypto.createHash("sha256").update(raw).digest();

  const payload = Buffer.concat([Buffer.from(`${ts}\n${fullUrl}\n`), bodyHash]);

  const expected = crypto
    .createHmac("sha256", SIGNING_KEY)
    .update(payload)
    .digest();

  const received = Buffer.from(sigB64, "base64");

  if (received.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
}

/* =========================================================
   WHATSAPP IDENTITY HELPERS
   ========================================================= */

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

/* =========================================================
   READ RECEIPTS
   ========================================================= */

function extractReadInteraction(evt) {
  const payload = evt?.payload || {};

  const isReadInteraction =
    evt?.service === "channels" &&
    evt?.event === "whatsapp.interaction" &&
    payload?.type === "read";

  if (!isReadInteraction) {
    return null;
  }

  return {
    messageId: normalizeId(payload.messageId),

    channelId: normalizeId(payload.channelId),

    readAt:
      normalizeId(payload.createdAt) ||
      normalizeId(payload.updatedAt) ||
      new Date().toISOString(),
  };
}

async function handleReadInteraction(readInteraction) {
  if (!readInteraction.messageId) {
    console.warn("Read interaction missing messageId", {
      channelId: readInteraction.channelId,
    });

    return;
  }

  if (readInteraction.channelId) {
    try {
      const organization = await getOrganizationByChannelId(
        readInteraction.channelId,
      );

      if (!organization) {
        console.warn("Read interaction channel has no organization", {
          channelId: readInteraction.channelId,
          messageId: readInteraction.messageId,
        });
      }
    } catch (err) {
      console.warn("Could not resolve read interaction organization", {
        channelId: readInteraction.channelId,

        messageId: readInteraction.messageId,

        message: err?.message || String(err),
      });
    }
  }

  const updated = await markMessageReadByProviderId(
    readInteraction.messageId,
    readInteraction.readAt,
  );

  if (!updated) {
    console.warn("Read interaction message not found locally", {
      messageId: readInteraction.messageId,

      channelId: readInteraction.channelId,

      readAt: readInteraction.readAt,
    });

    return;
  }

  if (!updated.message_chain_id) {
    return;
  }

  try {
    const chainResult = await processReadChainAfterRead(updated);

    console.log("Read chain processed after read interaction", {
      messageId: readInteraction.messageId,

      messageDbId: updated.id,

      chainId: updated.message_chain_id,

      stepIndex: updated.message_chain_step_index,

      result: chainResult,
    });
  } catch (err) {
    console.error("Failed to process read chain after read interaction", {
      messageId: readInteraction.messageId,

      messageDbId: updated.id,

      chainId: updated.message_chain_id,

      stepIndex: updated.message_chain_step_index,

      error: err?.message || String(err),
    });
  }
}

/* =========================================================
   USER LOOKUP
   ========================================================= */

async function findUserFromPhone(rawPhone) {
  const digits = String(rawPhone || "").replace(/\D/g, "");

  const { nationalNumber } = splitE164(rawPhone || "");

  let user = null;

  if (nationalNumber) {
    user = await getUserByNumber(nationalNumber);
  }

  if (!user && digits) {
    user = await getUserByNumber(digits);
  }

  return user;
}

async function findUserFromWhatsappIdentity(identity, organizationId = null) {
  if (identity.whatsappBsuid) {
    const user = await getUserByWhatsappBsuid(
      identity.whatsappBsuid,
      organizationId,
    );

    if (user) {
      return user;
    }
  }

  if (identity.birdContactId) {
    const user = await getUserByBirdContactId(
      identity.birdContactId,
      organizationId,
    );

    if (user) {
      return user;
    }
  }

  if (identity.phoneNumber) {
    return await findUserFromPhone(identity.phoneNumber);
  }

  return null;
}

/* =========================================================
   BIRD OUTBOUND MESSAGE
   ========================================================= */

function buildReceiverContact({ contactId, phoneNumber, whatsappBsuid }) {
  if (contactId) {
    return {
      id: contactId,
    };
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

      data: {
        error: "Missing MessageBird/Bird channelId",
      },

      providerMessageId: null,
    };
  }

  if (!receiverContact) {
    return {
      ok: false,
      status: 400,

      data: {
        error: "Missing MessageBird/Bird contactId",
      },

      providerMessageId: null,
    };
  }

  if (!process.env.WORKSPACE_ID) {
    return {
      ok: false,
      status: 500,

      data: {
        error: "Missing WORKSPACE_ID env variable",
      },

      providerMessageId: null,
    };
  }

  if (!process.env.BIRD_API_KEY) {
    return {
      ok: false,
      status: 500,

      data: {
        error: "Missing BIRD_API_KEY env variable",
      },

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
    data,

    providerMessageId: extractBirdMessageId(data),
  };
}

/* =========================================================
   ROUTES
   ========================================================= */

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "messagebird",
  });
}

export async function POST(req) {
  const rawBody = await req.text();

  const sigHeader = req.headers.get("messagebird-signature") ?? "";

  const tsHeader = req.headers.get("messagebird-request-timestamp") ?? "";

  const proto = req.headers.get("x-forwarded-proto") || "https";

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");

  const fullUrl =
    `${proto}://${host}` + `${req.nextUrl.pathname}` + `${req.nextUrl.search}`;

  const ok = isValid(sigHeader, tsHeader, fullUrl, rawBody);

  if (!ok) {
    console.warn("Invalid signature");

    return new NextResponse("invalid signature", {
      status: 401,
    });
  }

  try {
    await handleEvent(rawBody);

    return NextResponse.json({
      ok: true,
    });
  } catch (err) {
    console.error("MessageBird webhook failed", {
      message: err?.message,
      status: err?.status,
      type: err?.type,
      request_id: err?.request_id,
    });

    /*
     * We still return HTTP 200 to Bird.
     *
     * Otherwise Bird may keep retrying the
     * same webhook and accidentally create
     * duplicate AI responses/messages.
     */
    return NextResponse.json(
      {
        ok: false,

        error: err?.message || String(err),
      },
      {
        status: 200,
      },
    );
  }
}

/* =========================================================
   MAIN WEBHOOK HANDLER
   ========================================================= */

async function handleEvent(rawJSON) {
  let evt;

  try {
    evt = JSON.parse(rawJSON);
  } catch {
    console.warn("Webhook - bad JSON");

    return;
  }

  /* ---------------------------------------------------------
     READ RECEIPT
     --------------------------------------------------------- */

  const readInteraction = extractReadInteraction(evt);

  if (readInteraction) {
    await handleReadInteraction(readInteraction);

    return;
  }

  /* ---------------------------------------------------------
     INBOUND TEXT MESSAGE
     --------------------------------------------------------- */

  const isInboundText =
    evt.service === "channels" &&
    evt.event === "whatsapp.inbound" &&
    evt.payload?.body?.type === "text";

  if (!isInboundText) {
    return;
  }

  const identity = extractWhatsappIdentity(evt.payload);

  const contactId = identity.birdContactId;

  const text = evt.payload?.body?.text?.text || "";

  const sentChannelId =
    evt.payload?.channelId ||
    evt.payload?.channel?.id ||
    evt.payload?.receiver?.channel?.id ||
    null;

  const inboundMsgId =
    evt.payload?.id || evt.payload?.messageId || evt.payload?.body?.id || null;

  if (!identity.phoneNumber && !identity.whatsappBsuid && !contactId) {
    console.warn("Inbound WhatsApp event missing usable identity", {
      identity,
      sentChannelId,
    });

    return;
  }

  /* ---------------------------------------------------------
     RESOLVE ORGANIZATION FROM CHANNEL
     --------------------------------------------------------- */

  let channelOrganization = null;

  if (sentChannelId) {
    try {
      channelOrganization = await getOrganizationByChannelId(sentChannelId);
    } catch (err) {
      console.warn("Could not resolve organization by channel_id", {
        sentChannelId,

        message: err?.message || String(err),
      });
    }
  }

  /* ---------------------------------------------------------
     FIND USER
     --------------------------------------------------------- */

  let user = await findUserFromWhatsappIdentity(
    identity,
    channelOrganization?.id || null,
  );

  if (user) {
    user = await updateUserWhatsappIdentity(user.id, identity);
  }

  /* ---------------------------------------------------------
     UNREGISTERED USER
     --------------------------------------------------------- */

  if (!user) {
    const r = await sendBirdMessage({
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

    if (!r.ok) {
      console.error("Failed to send unregistered message:", r.data);
    }

    return;
  }

  /* ---------------------------------------------------------
     PENDING OUTREACH

     This stays before normal AI conversation handling.
     --------------------------------------------------------- */

  const pendingMessages = await getAllPendingOutreachByUser(user.id);

  if (Array.isArray(pendingMessages) && pendingMessages.length > 0) {
    await handlePendingMessages({
      user,
      inboundMsgId,
      contactId,
      inboundIdentity: identity,
      inboundText: text,
      pendingMessages,
      sentChannelId,
    });

    return;
  }

  /* ---------------------------------------------------------
     ORGANIZATION
     --------------------------------------------------------- */

  const organization = await getOrganization(user.organization_id);

  if (!organization) {
    console.warn("Organization not found for user", user.id);

    return;
  }

  /* ---------------------------------------------------------
     DATABASE ASSISTANT

     IMPORTANT:
     No assistant.open_ai_id anymore.

     The row returned here IS the assistant
     configuration.
     --------------------------------------------------------- */

  const assistantRow = await getAssistantFromUser(user, organization);

  if (!assistantRow) {
    console.warn("No assistants found for organization", organization.id);

    return;
  }

  if (!assistantRow.model) {
    throw new Error(`Assistant ${assistantRow.id} has no model configured`);
  }

  const channel = "whatsapp";

  /* =========================================================
     FIND DB THREAD
     ========================================================= */

  let thread = await getUserThreadForChannel({
    userId: user.id,

    assistantId: assistantRow.id,

    channel,
  });

  let conversationId = normalizeId(thread?.openai_conversation_id);

  /* =========================================================
     CASE 1:
     BRAND NEW THREAD

     No DB thread exists.

     Create:
       OpenAI Conversation
       +
       DB Thread
     ========================================================= */

  if (!thread) {
    const conversation = await createConversation({
      assistantId: assistantRow.id,

      organizationId: user.organization_id,

      userId: user.id,

      channel,

      scope: "user",
    });

    conversationId = normalizeId(conversation?.id);

    if (!conversationId) {
      throw new Error("OpenAI did not return a conversation ID");
    }

    thread = await createThread({
      userId: user.id,

      assistantId: assistantRow.id,

      /*
       * Old Assistants API field.
       *
       * New rows leave this NULL.
       */
      aiThreadId: null,

      /*
       * New OpenAI Conversation.
       */
      openAiConversationId: conversationId,

      channel,

      scope: "user",

      externalConversationId: null,
    });

    console.log("Created new WhatsApp OpenAI Conversation", {
      userId: user.id,

      assistantId: assistantRow.id,

      dbThreadId: thread.id,

      conversationId,
    });
  } else if (!conversationId) {

  /* =========================================================
     CASE 2:
     EXISTING LEGACY THREAD

     DB thread exists but it was created using
     the Assistants API:

       ai_thread_id = thread_...
       openai_conversation_id = NULL

     We migrate it once, lazily.
     ========================================================= */
    const previousMessages = await getMessagesInThread(thread.id);

    const historyItems = buildConversationHistoryItems(previousMessages);

    const conversation = await createConversation(
      {
        assistantId: assistantRow.id,

        organizationId: user.organization_id,

        userId: user.id,

        channel,

        scope: "user",

        migratedFromDbThreadId: thread.id,
      },

      historyItems,
    );

    conversationId = normalizeId(conversation?.id);

    if (!conversationId) {
      throw new Error(
        `Could not migrate DB thread ${thread.id} to an OpenAI Conversation`,
      );
    }

    thread = await setThreadConversationId(thread.id, conversationId);

    console.log("Migrated legacy WhatsApp thread to OpenAI Conversation", {
      userId: user.id,

      assistantId: assistantRow.id,

      dbThreadId: thread.id,

      legacyAiThreadId: thread.ai_thread_id || null,

      conversationId,

      migratedMessages: historyItems.length,
    });
  }

  /* =========================================================
     SAFETY CHECK
     ========================================================= */

  if (!conversationId) {
    throw new Error(
      `DB thread ${thread?.id ?? "unknown"} has no OpenAI Conversation ID`,
    );
  }

  /* =========================================================
     SAVE INBOUND MESSAGE TO OUR DATABASE

     IMPORTANT:
     This happens AFTER old-history migration so the
     current incoming message isn't copied into the
     Conversation and then sent a second time.
     ========================================================= */

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
  });

  /* =========================================================
     OPENAI RESPONSES API

     OLD FLOW REMOVED:

       assistant.open_ai_id
       createOAiThread()
       beta.threads.messages.create()
       beta.threads.runs.create()
       runs.retrieve()
       message polling

     NEW FLOW:

       DB assistant
       +
       conv_...
       +
       Responses API
     ========================================================= */

  const aiResponse = await generateAssistantResponse({
    assistant: assistantRow,

    conversationId,

    message: text,
  });

  const aiText = String(aiResponse?.aiResponse || "").trim();

  if (!aiText) {
    throw new Error("OpenAI returned an empty assistant response");
  }

  /* =========================================================
     SEND AI RESPONSE THROUGH BIRD
     ========================================================= */

  let outboundId = null;

  const outgoingChannelId =
    normalizeId(organization.channel_id) || normalizeId(sentChannelId);

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

  if (!sendRes.ok) {
    console.error("Failed to send assistant message:", sendRes.data);
  } else {
    outboundId = sendRes.providerMessageId;
  }

  /* =========================================================
     SAVE AI RESPONSE TO OUR DATABASE
     ========================================================= */

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
  });
}

/* =========================================================
   PENDING OUTREACH
   ========================================================= */

async function handlePendingMessages({
  user,
  inboundMsgId,
  contactId,
  inboundIdentity,
  inboundText,
  pendingMessages,
  sentChannelId,
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
  });

  const organization = await getOrganization(user.organization_id);

  if (!organization) {
    console.warn("Organization not found while sending pending outreach");

    return;
  }

  const outgoingChannelId =
    normalizeId(organization.channel_id) || normalizeId(sentChannelId);

  for (const row of pendingMessages) {
    const p = safePayload(row.payload);

    const hasImages = Array.isArray(p.imageUrls) && p.imageUrls.length > 0;

    const hasText = Boolean(String(p.message || "").trim());

    if (!hasImages && !hasText) {
      console.warn("Skipping empty pending outreach", {
        pendingOutreachId: row.id,

        userId: user.id,
      });

      continue;
    }

    const body = hasImages
      ? {
          type: "image",

          image: {
            images: p.imageUrls.map((u) => ({
              mediaUrl: u,
            })),

            ...(hasText
              ? {
                  text: p.message,
                }
              : {}),
          },
        }
      : {
          type: "text",

          text: {
            text: p.message || "",
          },
        };

    const sendRes = await sendBirdMessage({
      channelId: outgoingChannelId,

      contactId,

      phoneNumber: inboundIdentity?.phoneNumber || user.phone_number,

      whatsappBsuid: inboundIdentity?.whatsappBsuid || user.whatsapp_bsuid,

      body,
    });

    if (!sendRes.ok) {
      console.error("Failed to send pending outreach:", {
        pendingOutreachId: row.id,

        status: sendRes.status,

        data: sendRes.data,
      });

      continue;
    }

    const outboundId = sendRes.providerMessageId;

    const hasChainMetadata =
      row.message_chain_id &&
      row.message_chain_step_id &&
      row.message_chain_recipient_id &&
      row.message_chain_step_index;

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

      messageChainId: row.message_chain_id || null,

      messageChainStepId: row.message_chain_step_id || null,

      messageChainRecipientId: row.message_chain_recipient_id || null,

      messageChainStepIndex: row.message_chain_step_index || null,
    });

    if (hasChainMetadata) {
      try {
        await createMessageChainDelivery({
          chainId: row.message_chain_id,

          chainStepId: row.message_chain_step_id,

          chainRecipientId: row.message_chain_recipient_id,

          stepIndex: Number(row.message_chain_step_index),

          providerMessageId: outboundId,

          status: "sent",

          sentAt: new Date().toISOString(),
        });

        await updateMessageChainRecipientProgress({
          chainRecipientId: row.message_chain_recipient_id,

          currentStepIndex: Number(row.message_chain_step_index),

          status: "active",
        });

        console.log("Pending outreach chain step sent", {
          pendingOutreachId: row.id,

          chainId: row.message_chain_id,

          chainStepId: row.message_chain_step_id,

          chainRecipientId: row.message_chain_recipient_id,

          stepIndex: row.message_chain_step_index,

          providerMessageId: outboundId,
        });
      } catch (err) {
        console.error("Failed to update chain state for pending outreach", {
          pendingOutreachId: row.id,

          chainId: row.message_chain_id,

          stepIndex: row.message_chain_step_index,

          error: err?.message || String(err),
        });
      }
    }

    await markPendingOutreachReplied(row.id, inboundMsgId);
  }
}

/* =========================================================
   ASSISTANT RESOLUTION
   ========================================================= */

async function getAssistantFromUser(user, organization) {
  /*
   * Prefer the assistant explicitly assigned
   * to this user.
   */
  if (user.assistant_id) {
    const assistant = await getAssistantById(user.assistant_id);

    if (assistant) {
      return assistant;
    }
  }

  /*
   * Fallback:
   * first assistant belonging to organization.
   */
  const assistants = await getAssistantsInOrg(organization.id);

  if (!assistants?.length) {
    return null;
  }

  return assistants[0];
}
