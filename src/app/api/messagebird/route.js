/* --------------------
All the imports here and requirements are made in the beginning
DO NOT TOUCH
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

/* --------------------
Needed to check if the key we have is the
same as the message sent from the whatsapp provider
----------------------*/

const SIGNING_KEY = process.env.MESSAGEBIRD_SIGNING_KEY;

/**
 * Checks if an incoming webhook was really sent by Bird, not faked.
 * @param {string} sigB64 - signature sent by Bird
 * @param {string} ts - timestamp of when the request was signed
 * @param {string} fullUrl - full Public Url of the webhook endpoint´
 * @param {string} raw - raw request body, before any parsing
 * @returns {boolean} Whether the signature is valid or not
 */
function isValid(sigB64, ts, fullUrl, raw) {
  //If there is not signing key in the environment something is seriously wrong
  if (!SIGNING_KEY) return false;

  // Creates a SHA-256 hash of the raw request body.
  const bodyHash = crypto.createHash("sha256").update(raw).digest();

  // Builds the payload string used in the signature: "<ts>\n<url>\n<bodyHash>"
  const payload = Buffer.concat([
    Buffer.from(`${ts}\n${fullUrl}\n`), // ← use the public URL
    bodyHash,
  ]);

  // Recreates the expected signature but with our secret
  const expected = crypto
    .createHmac("sha256", SIGNING_KEY)
    .update(payload)
    .digest(); // binary buffer

  // Converts the base64 encoded signature from the header into binary
  const received = Buffer.from(sigB64, "base64");

  // Constant-Time comparison to prevent timing attacks
  return crypto.timingSafeEqual(expected, received);
}

async function getAssistantFromUser(user, organization) {
  if (user.assistant_id) {
    try {
      const assistant = await getAssistantById(Number(user.assistant_id));
      if (assistant && assistant.organization_id === organization.id)
        return assistant;
      console.warn(
        `User assistant ${user.assistant_id} not in org ${organization.id}; falling back`
      );
    } catch (err) {
      console.warn("Failed to load user assistant:", err?.message || e);
    }
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "messagebird" });
}

/**
 * Handles the incoming POST webhook request from Bird
 * Verifies the authenticity of the request using the HMAC signature and,
 * if valid, triggers asynchronous processing of the webhook event.
 *
 * @param {Request} req - The incoming HTTP request object from Next.js.
 * @returns {Promise<NextResponse>} A 200 response if the signature is valid, or a 401 Unauthorized if it isn't
 */
export async function POST(req) {
  //Getting the raw, unparsed body and extracting the relevant headers
  const rawBody = await req.text();
  const sigHeader = req.headers.get("messagebird-signature") ?? "";
  const tsHeader = req.headers.get("messagebird-request-timestamp") ?? "";

  //Reconstructing the full public URL of the webhook endpoint
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const fullUrl = `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`;

  //Validating the request using HMAC signature
  const ok = isValid(sigHeader, tsHeader, fullUrl, rawBody);

  if (!ok) {
    console.warn("✗ Invalid signature");
    return new NextResponse("invalid signature", { status: 401 });
  }

  try {
    await handleEvent(rawBody); // run the work before returning
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    // Keep 200 while debugging to avoid retries; switch to 500 if you want Bird to retry
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 200 }
    );
  }
}

/**
 * Processes  a raw webhook JSON payload from Bird
 * Verifies the structure
 * Checks if the user is registered
 * Routes the message to an Assistant
 * Sends the message the Assistant provided back via the Bird API
 *
 * @param {string} rawJSON - The raw JSON string from the webhook body
 * @returns
 */
async function handleEvent(rawJSON) {
  let evt;

  //Parses the raw JSON string into a JS object
  try {
    evt = JSON.parse(rawJSON);
  } catch {
    console.warn("Webhook - bad JSON");
    return;
  }

  //Makes sure that this is a WhatsApp text message
  if (
    evt.service === "channels" &&
    evt.event === "whatsapp.inbound" &&
    evt.payload?.body?.type === "text"
  ) {
    //Extracts values from the event

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

    //Splits the E.164 number into country code and local number
    const { countryCode, nationalNumber } = splitE164(fromNumber);

    //Checks if the sender is a registered User
    const user = await getUserByNumber(nationalNumber);

    //If the user isn't registered, send a default "unregistered" message back
    if (!user) {
      //Send message back saying they are not registered
      const res = await fetch(
        `https://api.bird.com/workspaces/${process.env.WORKSPACE_ID}/channels/${sentChannelId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `AccessKey ${process.env.BIRD_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receiver: {
              contacts: [
                {
                  id: contactId, // destination
                },
              ],
            },
            body: {
              type: "text",
              text: {
                text: "Este número não se encontra registado, por favor fale com os administradores.",
              },
            },
          }),
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ Failed to send message:", errorText);
        return NextResponse.json({ status: 400 });
      } else {
        const data = await res.json();
      }

      return NextResponse.json({ ok: true });
    }

    const pendingMessages = await getAllPendingOutreachByUser(user.id);

    if (pendingMessages.length) {
      handlePendingMessages(
        user,
        inboundMsgId,
        contactId,
        text,
        pendingMessages
      );
    }

    //Fetch user's organization and Assistants
    const organization = await getOrganization(user.organization_id);

    const assistantRow = await getAssistantFromUser(user, organization);

    if (!assistantRow) {
      //Do something when there are no assistants found
      console.warn("No assistants found for organization");
      return NextResponse.json({ error: "no assistants" }, { status: 400 });
    }

    const channel = "whatsapp";

    // Check if user already has a WhatsApp DM thread for this assistant
    let thread = await getUserThreadForChannel({
      userId: user.id,
      assistantId: assistantRow.id,
      channel,
    });

    // If not, create OpenAI thread + DB row
    if (!thread) {
      const aiThread = await createOAiThread(); // OpenAI thread
      thread = await createThread({
        userId: user.id,
        assistantId: assistantRow.id,
        aiThreadId: aiThread.id,
        channel,
        scope: "user",
        externalConversationId: null, // not needed for WhatsApp
      });
    }

    const aiThreadId = thread.ai_thread_id;

    await createMessage({
      threadId: thread?.id ?? null,
      userId: user.id,
      messageId: inboundMsgId,
      externalContactId: contactId,
      content: text,
      role: "user",
    });

    //Send to AI
    const aiResponse = await sendMessageToAi(
      assistantRow.open_ai_id,
      text,
      aiThreadId
    );

    let outboundId = null;
    const res = await fetch(
      `https://api.bird.com/workspaces/${process.env.WORKSPACE_ID}/channels/${organization.channel_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.BIRD_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiver: {
            contacts: [
              {
                id: contactId, // destination
              },
            ],
          },
          body: {
            type: "text",
            text: {
              text: aiResponse.aiResponse,
            },
          },
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ Failed to send message:", errorText);
    } else {
      const data = await res.json().catch(() => ({}));
      outboundId = data?.id ?? data?.message?.id ?? null;
    }

    await createMessage({
      threadId: thread?.id ?? null,
      userId: user.id,
      messageId: outboundId,
      externalContactId: contactId,
      content: aiResponse.aiResponse,
      role: "assistant",
    });
  }

  // Always ACK so Bird doesn’t retry
  return NextResponse.json({ ok: true });
}

async function handlePendingMessages(
  user,
  inboundMsgId,
  contactId,
  text,
  pendingMessages
) {
  await createMessage({
    threadId: null,
    userId: user.id,
    messageId: inboundMsgId,
    externalContactId: contactId,
    content: text,
    role: "user",
  });

  const organization = await getOrganization(user.organization_id);
  const sendPoint = `https://api.bird.com/workspaces/${process.env.WORKSPACE_ID}/channels/${organization.channel_id}/messages`;

  for (const row of pendingMessages) {
    const p = row.payload || {};

    const body =
      Array.isArray(p.imageUrls) && p.imageUrls.length
        ? {
            type: "image",
            image: {
              images: p.imageUrls.map(
                (u) => ({
                  altText: "image",
                  mediaUrl: u,
                }),
                ...(p.message ? { text: p.message } : {})
              ),
            },
          }
        : {
            type: "text",
            text: { text: p.message || "" },
          };

    const res = await fetch(sendPoint, {
      method: "POST",
      headers: {
        Authorization: `AccessKey ${process.env.BIRD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receiver: { contacts: [{ id: contactId }] },
        body,
      }),
    });

    let outboundId = null;
    try {
      const outJson = await res.json();
      outboundId = outJson?.id ?? outJson?.message?.id ?? null;
    } catch {
      // swallow parse errors; we'll still mark and log the attempt
    }

    await createMessage({
      threadId: null,
      userId: user.id,
      messageId: outboundId,
      externalContactId: contactId,
      content: p.message || "",
      role: "system",
    });

    await markPendingOutreachReplied(row.id, inboundMsgId);
  }

  return NextResponse.json({ ok: true });
}
