// /src/app/api/teams/messages/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { getAssistantById } from "@/lib/repos/assistants.repo";
import { createOAiThread, sendMessageToAi } from "@/lib/services/oAi.services";
import { getOrganization } from "@/lib/repos/organizations.repo";
import { createMessage } from "@/lib/repos/messages.repo";

import {
  getUserByAadObjectId,
  getUserById,
  updateUser,
} from "@/lib/repos/user.repo";
import { upsertUserTeamsConversation } from "@/lib/repos/teamConversations.repo";

const APP_ID = process.env.BOT_APP_ID?.trim();
const APP_PASSWORD = process.env.BOT_APP_PASSWORD?.trim();
const BF_SCOPE = "https://api.botframework.com/.default";

function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4 ? 4 - (str.length % 4) : 0;
  return Buffer.from(str + "=".repeat(pad), "base64").toString("utf8");
}

async function fetchTokenAuthority(authorityTenant) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: APP_ID,
    client_secret: APP_PASSWORD,
    scope: BF_SCOPE,
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${authorityTenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json)}`);

  const [, payload] = json.access_token.split(".");
  const claims = JSON.parse(b64urlDecode(payload));

  return json.access_token;
}

async function getBotToken(tenantHint) {
  if (!APP_ID || !APP_PASSWORD) {
    throw new Error("Missing BOT_APP_ID or BOT_APP_PASSWORD");
  }

  const order = [tenantHint, "botframework.com"].filter(Boolean);

  let lastErr;
  for (const t of order) {
    try {
      return await fetchTokenAuthority(t);
    } catch (err) {
      lastErr = err;
      console.warn(`[TOKEN FAIL via ${t}]`, err.message);
    }
  }
  throw lastErr || new Error("Unable to get bot token");
}

async function sendReply(activity, text) {
  const tenantHint = activity?.channelData?.tenant?.id;
  const token = await getBotToken(tenantHint);

  const base = activity.serviceUrl.endsWith("/")
    ? activity.serviceUrl
    : activity.serviceUrl + "/";

  const payload = { type: "message", text, replyToId: activity.id };

  const res = await fetch(
    `${base}v3/conversations/${activity.conversation.id}/activities`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    console.error("Failed to send reply: ", res.status, await res.text());
  }
}

async function handleUserInteraction(activity) {}

async function handleUserInstallation(activity) {
  const aadObjectId = activity.from?.aadObjectId;
  const tenantId =
    activity.conversation?.tenantId || activity.channelData?.tenant?.id;
  const teamsUserId = activity.from?.id;
  const conversationId = activity.conversation?.id;
  const serviceUrl = activity.serviceUrl;
  const conversationType =
    activity.conversation?.conversationType || "personal";

  if (
    !aadObjectId ||
    !teamsUserId ||
    !conversationId ||
    !serviceUrl ||
    !tenantId
  ) {
    console.warn("[TEAMS install] Missing required fields: ", {
      aadObjectId,
      teamsUserId,
      conversationId,
      serviceUrl,
      tenantId,
    });

    //TODO: Send message to user that something went wrong
    sendReply(
      activity,
      "Something went wrong, please contact the developers of MyDigitalBot."
    ).catch((e) => console.error("sendReply error: ", e));
    return;
  }

  let user = await getUserByAadObjectId(aadObjectId);

  if (!user) {
    console.warn("[TEAMS install] No user found for AAD:", aadObjectId);
    //TODO: Send message to user that their ID hasn't been added to MyDigitalBot and give out the conversationID
    sendReply(
      activity,
      `Your ID was not found on any of MyDigitalBot's users, please contact your admin so they can make the link manually or retry after making sure the ID is set. Your ID:${aadObjectId}, Conversation ID:${conversationId}, From ID:${teamsUserId}`
    ).catch((e) => console.error("sendReply error: ", e));
    return;
  }

  await upsertUserTeamsConversation({
    userId: user.id,
    teamsUserId,
    conversationId,
    serviceUrl,
    tenantId,
    conversationType,
  });

  console.log("[TEAMS install] Conversation linked:", {
    userId: user.id,
    teamsUserId,
    conversationId,
    tenantId,
  });

  //TODO: Send message to user that the conversation is linked and send a custom message, this can be an organization custom message or a system custom message

  sendReply(activity, "Conversation successfully connected.").catch((e) =>
    console.error("sendReply error: ", e)
  );
}

export async function POST(req) {
  const activity = await req.json();

  if (activity.type === "message" && activity.text) {
    console.log(activity);
    sendReply(activity, `Echo: ${activity.text}`).catch((e) =>
      console.error("sendReply error: ", e)
    );
  }

  // if (activity.type === "conversationUpdate") {
  //   console.log(activity);
  // }

  if (activity.type === "installationUpdate" && activity.action === "add") {
    console.log("[INSTALL] ", activity);
    await handleUserInstallation(activity);
  }

  if (activity.type === "installationUpdate" && activity.action === "remove") {
    console.log("[UNINSTALL] ", activity);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ status: 200 });
}

export async function OPTIONS(req) {
  const activity = await req.json();
  console.log("[OPTIONS] :", activity);

  return NextResponse.json({ status: 200 });
}
