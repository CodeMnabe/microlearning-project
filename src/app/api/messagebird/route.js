/* --------------------
WhatsApp inbound webhook
----------------------*/
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "crypto";

import { getUserByNumber } from "@/lib/repos/user.repo";
import {
  createThread,
  getUserThreadForChannel,
} from "@/lib/repos/threads.repo";
import {
  getAssistantById,
  getAssistantsInOrg,
} from "@/lib/repos/assistants.repo";
import { createOAiThread, sendMessageToAi } from "@/lib/services/oAi.services";
import { getOrganization } from "@/lib/repos/organizations.repo";
import { createMessage } from "@/lib/repos/messages.repo";
import {
  getAllPendingOutreachByUser,
  markPendingOutreachReplied,
} from "@/lib/repos/pendingOutreach.repo";
import { splitE164 } from "@/lib/whatsapp/E164";

const SIGNING_KEY = process.env.MESSAGEBIRD_SIGNING_KEY;

function normalizeId(value) {
  if (value === undefined || value === null) return null;

  const str = String(value).trim();
  return str.length > 0 ? str : null;
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

async function getAssistantFromUser(user, organization) {
  if (user?.assistant_id) {
    try {
      const assistant = await getAssistantById(Number(user.assistant_id));

      if (
        assistant &&
        String(assistant.organization_id) === String(organization.id)
      ) {
        return assistant;
      }

      console.warn(
        `User assistant ${user.assistant_id} not in org ${organization.id}; falling back`,
      );
    } catch (err) {
      console.warn("Failed to load user assistant:", err?.message || err);
    }
  }

  try {
    const assistants = await getAssistantsInOrg(organization.id);

    if (Array.isArray(assistants) && assistants.length > 0) {
      return assistants[0];
    }
  } catch (err) {
    console.warn("Failed to load org assistants:", err?.message || err);
  }

  return null;
}

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

async function sendBirdMessage({ channelId, contactId, body }) {
  const cleanChannelId = normalizeId(channelId);
  const cleanContactId = normalizeId(contactId);

  if (!cleanChannelId) {
    return {
      ok: false,
      status: 400,
      data: { error: "Missing MessageBird/Bird channelId" },
    };
  }

  if (!cleanContactId) {
    return {
      ok: false,
      status: 400,
      data: { error: "Missing MessageBird/Bird contactId" },
    };
  }

  if (!process.env.WORKSPACE_ID) {
    return {
      ok: false,
      status: 500,
      data: { error: "Missing WORKSPACE_ID env variable" },
    };
  }

  if (!process.env.BIRD_API_KEY) {
    return {
      ok: false,
      status: 500,
      data: { error: "Missing BIRD_API_KEY env variable" },
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
            contacts: [{ id: cleanContactId }],
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
  };
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "messagebird" });
}

export async function POST(req) {
  const rawBody = await req.text();

  const sigHeader = req.headers.get("messagebird-signature") ?? "";
  const tsHeader = req.headers.get("messagebird-request-timestamp") ?? "";

  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const fullUrl = `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`;

  const ok = isValid(sigHeader, tsHeader, fullUrl, rawBody);

  if (!ok) {
    console.warn("Invalid signature");
    return new NextResponse("invalid signature", { status: 401 });
  }

  try {
    await handleEvent(rawBody);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("MessageBird webhook failed", {
      message: err?.message,
      status: err?.status,
      type: err?.type,
      request_id: err?.request_id,
    });

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || String(err),
      },
      { status: 200 },
    );
  }
}

async function handleEvent(rawJSON) {
  let evt;

  try {
    evt = JSON.parse(rawJSON);
  } catch {
    console.warn("Webhook - bad JSON");
    return;
  }

  const isInboundText =
    evt.service === "channels" &&
    evt.event === "whatsapp.inbound" &&
    evt.payload?.body?.type === "text";

  if (!isInboundText) return;

  const fromNumber =
    evt.payload?.sender?.contact?.identifierValue ||
    evt.payload?.sender?.identifierValue ||
    "";

  const contactId =
    evt.payload?.sender?.contact?.id || evt.payload?.contact?.id || null;

  const text = evt.payload?.body?.text?.text || "";

  const sentChannelId =
    evt.payload?.channelId ||
    evt.payload?.channel?.id ||
    evt.payload?.receiver?.channel?.id ||
    null;

  const inboundMsgId =
    evt.payload?.id || evt.payload?.messageId || evt.payload?.body?.id || null;

  if (!fromNumber || !contactId) {
    console.warn("Inbound WhatsApp event missing fromNumber or contactId", {
      fromNumber,
      contactId,
    });
    return;
  }

  const user = await findUserFromPhone(fromNumber);

  if (!user) {
    const r = await sendBirdMessage({
      channelId: sentChannelId,
      contactId,
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

  const pendingMessages = await getAllPendingOutreachByUser(user.id);

  if (Array.isArray(pendingMessages) && pendingMessages.length > 0) {
    await handlePendingMessages({
      user,
      inboundMsgId,
      contactId,
      inboundText: text,
      pendingMessages,
      sentChannelId,
    });

    return;
  }

  const organization = await getOrganization(user.organization_id);

  if (!organization) {
    console.warn("Organization not found for user", user.id);
    return;
  }

  const assistantRow = await getAssistantFromUser(user, organization);

  if (!assistantRow) {
    console.warn("No assistants found for organization", organization.id);
    return;
  }

  const assistantOpenAiId = getAssistantOpenAiId(assistantRow);

  if (!assistantOpenAiId) {
    throw new Error(`Assistant ${assistantRow.id} is missing open_ai_id`);
  }

  const channel = "whatsapp";

  let thread = await getUserThreadForChannel({
    userId: user.id,
    assistantId: assistantRow.id,
    channel,
  });

  let aiThreadId = getThreadAiThreadId(thread);

  if (!thread) {
    const aiThread = await createOAiThread();

    aiThreadId = normalizeId(aiThread?.id);

    if (!aiThreadId) {
      throw new Error("createOAiThread did not return an OpenAI thread id");
    }

    thread = await createThread({
      userId: user.id,
      assistantId: assistantRow.id,
      aiThreadId,
      channel,
      scope: "user",
      externalConversationId: null,
    });
  }

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
  });

  const aiResponse = await sendMessageToAi(assistantOpenAiId, text, aiThreadId);

  const aiText = getAiResponseText(aiResponse);

  if (!aiText.trim()) {
    throw new Error("OpenAI returned an empty assistant response");
  }

  let outboundId = null;

  const outgoingChannelId =
    normalizeId(organization.channel_id) || normalizeId(sentChannelId);

  const sendRes = await sendBirdMessage({
    channelId: outgoingChannelId,
    contactId,
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
    outboundId = sendRes.data?.id ?? sendRes.data?.message?.id ?? null;
  }

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

async function handlePendingMessages({
  user,
  inboundMsgId,
  contactId,
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
    const p = row.payload || {};

    const hasImages = Array.isArray(p.imageUrls) && p.imageUrls.length > 0;
    const hasText = Boolean(String(p.message || "").trim());

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

    const sendRes = await sendBirdMessage({
      channelId: outgoingChannelId,
      contactId,
      body,
    });

    if (!sendRes.ok) {
      console.error("Failed to send pending outreach:", sendRes.data);
      continue;
    }

    const outboundId = sendRes.data?.id ?? sendRes.data?.message?.id ?? null;

    await createMessage({
      threadId: null,
      userId: user.id,
      organizationId: user.organization_id,
      assistantId: user.assistant_id ?? null,
      channel: "whatsapp",
      messageId: outboundId,
      externalContactId: contactId,
      content: p.message || "",
      role: "system",
      deliveryStatus: "accepted",
    });

    await markPendingOutreachReplied(row.id, inboundMsgId);
  }
}
