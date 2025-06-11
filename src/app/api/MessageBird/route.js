require("dotenv").config();
import { NextResponse } from "next/server";
import crypto from "crypto";

import { getUserByNumber } from "@/lib/repos/user.repo";
import { createThread, getThreadsForUser } from "@/lib/repos/threads.repo";
import {
  getAssistantById,
  getAssistantsInOrg,
} from "@/lib/repos/assistants.repo";
import { createOAiThread, sendMessageToAi } from "@/lib/services/oAi.services";
import { getOrganization } from "@/lib/repos/organizations.repo";

const SIGNING_KEY = process.env.SIGNING_KEY;

function isValid(sigB64, ts, fullUrl, raw) {
  if (!SIGNING_KEY) return false; // safety

  // 1. binary body hash
  const bodyHash = crypto.createHash("sha256").update(raw).digest();

  // 2. build payload   "<ts>\n<url>\n<bodyHash>"
  const payload = Buffer.concat([
    Buffer.from(`${ts}\n${fullUrl}\n`), // ← use the public URL
    bodyHash,
  ]);

  // 3. HMAC-SHA256 with your secret
  const expected = crypto
    .createHmac("sha256", SIGNING_KEY)
    .update(payload)
    .digest(); // binary buffer

  // 4. what Bird sent (base64 → binary)
  const received = Buffer.from(sigB64, "base64");

  // 5. constant-time compare
  return crypto.timingSafeEqual(expected, received);
}

export async function POST(req) {
  const rawBody = await req.text(); // untouched body
  const sigHeader = req.headers.get("messagebird-signature") ?? "";
  const tsHeader = req.headers.get("messagebird-request-timestamp") ?? "";

  // inside POST
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const fullUrl = `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`;

  const ok = isValid(sigHeader, tsHeader, fullUrl, rawBody);

  if (!ok) {
    console.warn("✗ Invalid signature");
    return new NextResponse("invalid signature", { status: 401 });
  }

  const response = NextResponse.json({ ok: true });

  // 👇 Process webhook *asynchronously*
  handleEvent(rawBody).catch((err) =>
    console.error("Error in webhook handler:", err)
  );

  return response;
}

async function handleEvent(rawJSON) {
  let evt;
  try {
    evt = JSON.parse(rawJSON);
  } catch {
    console.warn("Webhook - bad JSON");
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  if (
    evt.service === "channels" &&
    evt.event === "whatsapp.inbound" &&
    evt.payload?.body?.type === "text"
  ) {
    const fromNumber =
      evt.payload.sender?.contact?.identifierValue ?? "unknown";
    const contactName = evt.payload.sender?.contact?.annotations?.name ?? "";
    const text = evt.payload.body.text.text;
    const sentChannelId = evt.payload?.channel?.id;

    console.log(`📨 ${contactName} (${fromNumber}) → "${text}"`);

    /* ---------------------------------------------------
       TODO: 
         1. Check if number is associated with any organization, if not send answer back saying they're not registered
         2. Check what Assistant is associated with that user, if none is associated check for the organization's Assistants and choose one
         3. Send the message to the Assistant
         4. Receive a message back from the Assistant
         5. Log everything that transpired into the database, for example: who sent it, what the person sent, the thread of the conversation, the message back
         6. Send a message back with the MessageBird API 
    ---------------------------------------------------- */

    const { countryCode, nationalNumber } = splitE164(fromNumber);

    const user = await getUserByNumber(nationalNumber);

    if (!user) {
      //Send message back saying they are not registered
      const res = await fetch(
        `https://api.bird.com/workspaces/${process.env.WORKSPACE_ID}/channels/${sentChannelId}/messages`,
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
                  identifierValue: fromNumber, // destination
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
      } else {
        const data = await res.json();
      }

      return NextResponse.json({ ok: true });
    }

    const organization = await getOrganization(user.organizationId);

    const assistants = await getAssistantsInOrg(organization.id);

    if (!assistants) {
      //Do something when there are no assistants found
    }

    //Check if user has any Threads already
    let threads = await getThreadsForUser(user.id);
    let thread = threads[threads.length - 1];
    let aiThreadId;
    let assistantId;

    if (!thread) {
      console.log("Creating new thread since user doesn't have one");
      assistantId = assistants[0]?.id;
      const aiThread = await createOAiThread();
      console.log(aiThread);
      aiThreadId = aiThread.id;

      thread = await createThread({ userId: user.id, assistantId, aiThreadId });
    } else {
      assistantId = thread.assistantId;
      aiThreadId = thread.aiThreadId;
    }

    //Get Assistant from thread
    const assistant = await getAssistantById(Number(assistantId));

    //Send to AI
    const aiResponse = await sendMessageToAi(
      assistant.openAiId,
      text,
      thread.aiThreadId
    );
    console.log(aiResponse);

    const res = await fetch(
      `https://api.bird.com/workspaces/${process.env.WORKSPACE_ID}/channels/${organization.channelId}/messages`,
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
                identifierValue: fromNumber, // destination
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
      const data = await res.json();
    }
  }

  // Always ACK so Bird doesn’t retry
  return NextResponse.json({ ok: true });
}

export function splitE164(e164) {
  // 1) Basic validation
  if (!/^\+\d{6,15}$/.test(e164)) {
    throw new Error("Invalid E.164 number: " + e164);
  }

  // 2) Country codes are 1-3 digits long.
  //    We'll assume the national (local) part must be at least 6 digits,
  //    so try the longest CC first, then fallback.
  for (let ccLen = 3; ccLen >= 1; ccLen--) {
    const countryCode = e164.slice(0, 1 + ccLen); // "+351"
    const national = e164.slice(1 + ccLen); // "925273952"
    if (national.length >= 6) {
      return { countryCode, nationalNumber: national };
    }
  }

  // Should never reach here if input passed the regex
  throw new Error("Unable to split E.164 number: " + e164);
}
