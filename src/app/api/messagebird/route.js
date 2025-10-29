// src/app/api/messagebird/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* -------------------- Imports (unchanged) -------------------- */
import { NextResponse } from "next/server";
import crypto from "crypto";

import { getUserByNumber } from "@/lib/repos/user.repo";
import {
  createThread,
  getOrCreateThread,
  getThreadsForUser,
} from "@/lib/repos/threads.repo";
import {
  getAssistantById,
  getAssistantsInOrg,
} from "@/lib/repos/assistants.repo";
import { getStoreById } from "@/lib/repos/store.repo";
import { respondOnce } from "@/lib/services/oAi.services";
import { getOrganization } from "@/lib/repos/organizations.repo";
import { createMessage } from "@/lib/repos/messages.repo";
import {
  getAllPendingOutreachByUser,
  markPendingOutreachReplied,
} from "@/lib/repos/pendingOutreach.repo";

/* -------------------- Signature -------------------- */
const SIGNING_KEY = process.env.MESSAGEBIRD_SIGNING_KEY;

function isValid(sigB64, ts, fullUrl, raw) {
  if (!SIGNING_KEY) return false;
  const bodyHash = crypto.createHash("sha256").update(raw).digest();
  const payload = Buffer.concat([Buffer.from(`${ts}\n${fullUrl}\n`), bodyHash]);
  const expected = crypto
    .createHmac("sha256", SIGNING_KEY)
    .update(payload)
    .digest();
  const received = Buffer.from(sigB64 || "", "base64");
  try {
    return crypto.timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

/* -------------------- Helpers -------------------- */
async function getAssistantFromUserOrOrg(user, organization) {
  // 1) user-bound assistant
  if (user?.assistant_id) {
    try {
      const a = await getAssistantById(Number(user.assistant_id));
      if (a && a.organization_id === organization.id) return a;
    } catch (e) {
      console.warn("Failed to load user assistant:", e?.message || e);
    }
  }
  // 2) first assistant in org as fallback
  try {
    const list = await getAssistantsInOrg(organization.id);
    return list?.[0] || null;
  } catch (e) {
    console.warn("No assistants found for org:", e?.message || e);
    return null;
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "messagebird" });
}

/* -------------------- Webhook -------------------- */
export async function POST(req) {
  const rawBody = await req.text();
  const sigHeader = req.headers.get("messagebird-signature") ?? "";
  const tsHeader = req.headers.get("messagebird-request-timestamp") ?? "";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const fullUrl = `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`;

  const ok = isValid(sigHeader, tsHeader, fullUrl, rawBody);
  if (!ok) return new NextResponse("invalid signature", { status: 401 });

  try {
    await handleEvent(rawBody);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    // Return 200 to avoid retries while you debug
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 200 }
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

  if (
    evt.service === "channels" &&
    evt.event === "whatsapp.inbound" &&
    evt.payload?.body?.type === "text"
  ) {
    const fromNumber = evt.payload.sender?.contact?.identifierValue;
    const contactId = evt.payload.sender?.contact?.id ?? "unknown";
    const contactName = evt.payload.sender?.contact?.annotations?.name ?? "";
    const text = evt.payload.body.text.text;
    const sentChannelId = evt.payload?.channelId;

    const inboundMsgId =
      evt.payload?.id ||
      evt.payload?.messageId ||
      evt.payload?.body?.id ||
      null;

    // E.164 split (be permissive: if it fails, keep full)
    let nationalNumber = fromNumber;
    try {
      const { nationalNumber: n } = splitE164(fromNumber);
      nationalNumber = n;
    } catch {}

    const user = await getUserByNumber(nationalNumber);

    // If not registered, send default message back
    if (!user) {
      await sendBirdText(
        sentChannelId,
        contactId,
        "Este número não se encontra registado, por favor fale com os administradores."
      );
      return;
    }

    const pendingMessages = await getAllPendingOutreachByUser(user.id);
    if (pendingMessages.length) {
      // 1) log user ack
      await createMessage({
        threadId: null,
        userId: user.id,
        messageId: inboundMsgId,
        whatsAppId: contactId,
        content: text,
        role: "user",
      });

      // 2) send all pendings, log, mark replied
      const organization = await getOrganization(user.organization_id);
      for (const row of pendingMessages) {
        const p = row.payload || {};
        const outboundId = await sendBirdPayload(
          organization.channel_id,
          contactId,
          p
        );
        await createMessage({
          threadId: null,
          userId: user.id,
          messageId: outboundId,
          whatsAppId: contactId,
          content: p.message || "",
          role: "system",
        });
        await markPendingOutreachReplied(row.id, inboundMsgId);
      }
      return;
    }

    // Normal assistant reply flow (Responses API)
    const organization = await getOrganization(user.organization_id);
    const assistantRow = await getAssistantFromUserOrOrg(user, organization);
    if (!assistantRow) return;

    // Optional: maintain DB thread (no OpenAI thread required anymore)
    let thread = (await getThreadsForUser(user.id))?.[0];
    if (!thread) {
      thread = await getOrCreateThread({
        userId: user.id,
        assistantId: assistantRow.id,
        aiThreadId: null, // no OpenAI thread
      });
    }

    await createMessage({
      threadId: thread?.id ?? null,
      userId: user.id,
      messageId: inboundMsgId,
      whatsAppId: contactId,
      content: text,
      role: "user",
    });

    let vectorStoreOpenAiId = null;
    if (assistantRow.vector_store_id) {
      const store = await getStoreById(assistantRow.vector_store_id);
      vectorStoreOpenAiId = store?.open_ai_id || null;
    }

    const aiText = await respondOnce({
      model: assistantRow.model,
      instructions: assistantRow.instructions,
      input: text,
      vectorStoreOpenAiId,
    });

    const outboundId = await sendBirdText(
      organization.channel_id,
      contactId,
      aiText
    );

    await createMessage({
      threadId: thread?.id ?? null,
      userId: user.id,
      messageId: outboundId,
      whatsAppId: contactId,
      content: aiText,
      role: "assistant",
    });
  }
}

// Always ACK function returns handled above

/* -------------------- Bird send helpers -------------------- */
async function sendBirdText(channelId, contactId, text) {
  const endpoint = `https://api.bird.com/workspaces/${process.env.WORKSPACE_ID}/channels/${channelId}/messages`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `AccessKey ${process.env.BIRD_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      receiver: { contacts: [{ id: contactId }] },
      body: { type: "text", text: { text } },
    }),
  });

  let outboundId = null;
  try {
    const j = await res.json();
    outboundId = j?.id ?? j?.message?.id ?? null;
  } catch {}
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("❌ Bird send failed:", res.status, t);
  }
  return outboundId;
}

async function sendBirdPayload(channelId, contactId, p) {
  const endpoint = `https://api.bird.com/workspaces/${process.env.WORKSPACE_ID}/channels/${channelId}/messages`;
  const body =
    Array.isArray(p.imageUrls) && p.imageUrls.length
      ? {
          type: "image",
          image: {
            images: p.imageUrls.map((u) => ({ altText: "image", mediaUrl: u })),
            ...(p.message ? { text: p.message } : {}),
          },
        }
      : { type: "text", text: { text: p.message || "" } };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `AccessKey ${process.env.BIRD_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ receiver: { contacts: [{ id: contactId }] }, body }),
  });

  let outboundId = null;
  try {
    const j = await res.json();
    outboundId = j?.id ?? j?.message?.id ?? null;
  } catch {}
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("❌ Bird send failed:", res.status, t);
  }
  return outboundId;
}

/* -------------------- Number utils -------------------- */
export function splitE164(e164) {
  if (!/^\+\d{6,15}$/.test(e164)) {
    throw new Error("Invalid E.164 number: " + e164);
  }
  for (let ccLen = 3; ccLen >= 1; ccLen--) {
    const countryCode = e164.slice(0, 1 + ccLen);
    const national = e164.slice(1 + ccLen);
    if (national.length >= 6) {
      return { countryCode, nationalNumber: national };
    }
  }
  throw new Error("Unable to split E.164 number: " + e164);
}
