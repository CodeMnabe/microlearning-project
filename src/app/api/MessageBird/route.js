/* --------------------
All the imports here and requirements are made in the beginning
DO NOT TOUCH
----------------------*/

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

/* --------------------
Needed to check if the key we have is the
same as the message sent from the whatsapp provider
----------------------*/

const SIGNING_KEY = process.env.SIGNING_KEY;

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

/**
 * Handles the incoming POSt webhook request from Bird
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

  const response = NextResponse.json({ ok: true });

  //Process webhook *asynchronously*
  handleEvent(rawBody).catch((err) =>
    console.error("Error in webhook handler:", err)
  );

  return response;
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
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  //Makes sure that this is a WhatsApp text message
  if (
    evt.service === "channels" &&
    evt.event === "whatsapp.inbound" &&
    evt.payload?.body?.type === "text"
  ) {
    //Extracts values from the event
    const fromNumber =
      evt.payload.sender?.contact?.identifierValue ?? "unknown";
    const contactName = evt.payload.sender?.contact?.annotations?.name ?? "";
    const text = evt.payload.body.text.text;
    const sentChannelId = evt.payload?.channel?.id;

    console.log(`📨 ${contactName} (${fromNumber}) → "${text}"`);

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

    //Fetch user's organization and Assistants
    const organization = await getOrganization(user.organizationId);

    const assistants = await getAssistantsInOrg(organization.id);

    if (!assistants) {
      //Do something when there are no assistants found
      console.warn("No assistants found for organization");
      return NextResponse.json({ error: "no assistants" }, { status: 400 });
    }

    //Check if user has any Threads already
    let threads = await getThreadsForUser(user.id);
    let thread = threads[threads.length - 1];
    let aiThreadId;
    let assistantId;

    //If the user doesn't have any threads it creates a new thread and associates it with the user
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

/**
 * Splits a valid E.164 phone number into its country code and national number
 *
 * @param {string} e164 - A phone number in the E.164 format
 * @returns {{ countryCode: string, nationalNumber: string}} Parsed country code and national number
 * @throws {Error} If the input is not a valid E.164 number or cannot be split
 */
export function splitE164(e164) {
  // Validate that the input matches the E.164 format
  if (!/^\+\d{6,15}$/.test(e164)) {
    throw new Error("Invalid E.164 number: " + e164);
  }

  // Try to extract the country code and national number
  // Country codes are between 1 and 3 digits long (e.g., +1, +44, +351)
  // The national number must be at least 6 digits long
  for (let ccLen = 3; ccLen >= 1; ccLen--) {
    // Slice out the potential country code from the start
    const countryCode = e164.slice(0, 1 + ccLen);
    // Slice the rest as the national number
    const national = e164.slice(1 + ccLen);

    // Ensure the remaining number is at least 6 digits
    if (national.length >= 6) {
      return { countryCode, nationalNumber: national };
    }
  }

  // Should never reach here if input passed the regex
  throw new Error("Unable to split E.164 number: " + e164);
}
