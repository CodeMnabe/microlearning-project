// /src/app/api/teams/messages/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  getAssistantById,
  getFirstAssistantInOrg,
} from "@/lib/repos/assistants.repo";
import { createOAiThread, sendMessageToAi } from "@/lib/services/oAi.services";
import {
  getOrganization,
  getOrganizationByTeamsTenantId,
} from "@/lib/repos/organizations.repo";
import { createMessage } from "@/lib/repos/messages.repo";

import {
  createUser,
  getUserByAadObjectId,
  getUserByEmail,
  getUserById,
  updateUser,
} from "@/lib/repos/user.repo";
import { upsertUserTeamsConversation } from "@/lib/repos/teamConversations.repo";
import {
  createThread,
  getUserThreadForChannel,
  getGroupThreadForConversation,
} from "@/lib/repos/threads.repo";
import { getBotToken } from "@/lib/teams/auth";

async function sendReply(activity, text, opts = {}) {
  const {
    replyToId = activity?.id,
    serviceUrl = activity?.serviceUrl,
    conversationId = activity?.conversation?.id,
  } = opts;

  if (!serviceUrl || !conversationId) {
    console.error("[TEAMS] sendReply missing serviceUrl/conversationId", {
      serviceUrl,
      conversationId,
    });
    return { ok: false, error: "Missing serviceUrl/conversationId" };
  }

  const token = await getBotToken();

  const base = serviceUrl.endsWith("/") ? serviceUrl : serviceUrl + "/";
  const url = `${base}v3/conversations/${conversationId}/activities`;

  const payload = {
    type: "message",
    text: String(text ?? ""),
    ...(replyToId ? { replyToId } : {}),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[TEAMS] Failed to send reply", res.status, body);
    return { ok: false, status: res.status, body };
  }

  return { ok: true };
}

async function cmdWhoAmI(activity) {
  const tenantId = await GetTenantId(activity);
  const aadObjectId = await GetAadObjectId(activity);
  const fromId = await GetFromId(activity);

  return [
    `Tenant ID: ${tenantId || "-"}`,
    `From Id: ${fromId || "-"}`,
    `Aad Object Id: ${aadObjectId || "-"}`,
  ].join("<br>");
}

async function cmdConnect(activity) {
  const tenantId = await GetTenantId(activity);
  const aadObjectId = await GetAadObjectId(activity);
  const fromId = await GetFromId(activity);
  const conversationId = activity?.conversation?.id;
  const serviceUrl = activity?.serviceUrl;
  const conversationType = await GetConversationType(activity);

  console.log(`Tenant ID: ${tenantId}`);

  if (!tenantId) {
    return "The Tenant Id couldn't be detected. Please try again or contact support.";
  }

  const org = await getOrganizationByTeamsTenantId(tenantId);
  if (!org) {
    return "Your organization isn't registered in MyDigitalBot.com. Ask your admin or register it first.";
  }

  if (!aadObjectId || !fromId || !conversationId || !serviceUrl) {
    return [
      "I'm missing required data to connect your account",
      `AAD Object ID: ${aadObjectId || "-"}`,
      `Teams User ID: ${fromId || "-"}`,
      `Conversation ID: ${conversationId || "-"}`,
      `ServiceUrl: ${serviceUrl || "-"}`,
    ].join("<br>");
  }

  const user = await getUserByAadObjectId(aadObjectId);
  if (!user) {
    return [
      "You're not linked to a MyDigitalBot user yet.",
      "Send this to your admin so they can add you:",
      `Tenant ID: ${tenantId}`,
      `AAD Object ID: ${aadObjectId}`,
    ].join("<br>");
  }

  await upsertUserTeamsConversation({
    userId: user.id,
    teamsUserId: fromId,
    conversationId,
    serviceUrl,
    tenantId,
    conversationType,
  });

  return "Connected! You can now use the bot normally";
}

//TODO: Make the user register their AAD OBJECT ID with the email address
async function cmdReconnect(arg, activity) {
  const tenant = activity?.conversation?.tenantId || null;
  const aadObjectId = activity?.from?.aadObjectId || null;
  const fromId = activity?.from?.id || null;

  if (!tenant)
    return `Couldn't read the Tenant ID from this message, try again later or contact MyDigitalBot support.`;
  if (!aadObjectId || !fromId) {
    return `Something went wrong and I don't have access to your IDs, try again later or contact MyDigitalBot support.`;
  }

  let userId;
  try {
    userId = await getUserByEmail(arg, tenant);
  } catch (err) {
    if (err.code === "AMBIGUOUS_EMAIL_TENANT") {
      return `That email exists in multiple times in this tenant. Ask your admin to fix the duplicates.`;
    }
    throw err;
  }

  if (!userId) {
    return `No user found for ${arg} in this tenant. Ask your admin to create the user first.`;
  }

  await updateUser(userId, {
    teamsAadObjectId: aadObjectId,
    teamsFromId: fromId,
  });

  return `Linked Teams to ${arg}`;
}

async function cmdCreateUser(arg, activity) {
  const tenant = activity?.conversation?.tenantId || null;
  const aadObjectId = activity?.from?.aadObjectId || null;
  const fromId = activity?.from?.id || null;

  if (!tenant)
    return `Couldn't read the Tenant ID from this message, try again later or contact MyDigitalBot support.`;
  if (!aadObjectId || !fromId) {
    return `Something went wrong and I don't have access to your IDs, try again later or contact MyDigitalBot support.`;
  }

  let org = await getOrganizationByTeamsTenantId(tenant);

  if (!org) {
    return `Couldn't find an organization with this Tenant ID, try again after contacting your admin or contact MyDigitalBot support.`;
  }

  const assistant = await getFirstAssistantInOrg(org.id);

  const newUser = await createUser({
    organizationId: org.id,
    phoneNumber: null,
    phoneCountryCode: null,
    phoneNational: null,
    name: activity?.from?.name,
    email: arg[0],
    assistantId: assistant.id,
    teamsAadObjectId: aadObjectId,
    teamsFromId: fromId,
  });

  await cmdConnect(activity);

  return `You were successfully registered using the email ${newUser.email}`;
}

async function CheckForCommandMessage(activity) {
  const message = activity?.text.trim();

  if (!message) return { isCommand: false };

  const hasCommand = message.match(
    /^(--|\/|!)([a-z][\w-]*)(?:\s+(.+)|=(.+))?$/i,
  );

  if (!hasCommand) return { isCommand: false };

  const name = hasCommand[2].toLowerCase();
  const argString = (hasCommand[3] ?? hasCommand[4] ?? "").trim();
  const args = argString ? argString.split(/\s+/) : [];

  return { isCommand: true, command: name, argString, args };
}

async function CheckCommands(cmd, activity) {
  let text;
  console.log(activity);
  switch (cmd.command) {
    case "help":
      text = `--help: Check the list for the commands<br>--status: Check the status of the bot<br>--whoami: show your IDs<br>--reconnect: Remake the connection to the database<br>--register email@example.com: Type in your email associated with your MyDigitalBot user to register your id.`;

      return text;
    case "status":
      text = "Bot is active";
      return text;
    case "whoami":
      return await cmdWhoAmI(activity);

    case "connect":
      return await cmdConnect(activity);
    case "reconnect":
      return await cmdReconnect(cmd.args, activity);
    case "register":
      return await cmdCreateUser(cmd.args, activity);
    default:
      return `Unknown Command: ${cmd.command}<br>Try --help`;
  }
}

async function handleUserInteraction(activity) {
  const cmd = await CheckForCommandMessage(activity);

  if (cmd.isCommand) {
    const text = await CheckCommands(cmd, activity);
    sendReply(activity, text);
    return;
  }

  const tenantHint = activity?.channelData?.tenant?.id;
  const org = await getOrganizationByTeamsTenantId(tenantHint);

  const token = await getBotToken();

  //If the organization wasn't found send back a message to check the services we're providing and to register
  if (!org) {
    const base = activity.serviceUrl.endsWith("/")
      ? activity.serviceUrl
      : activity.serviceUrl + "/";

    const payload = {
      type: "message",
      text: "It seems you're tenant is not registered and thus not able to use this service, please go to MyDigitalBot.com and register there",
      replyToId: activity.id,
    };

    const res = await fetch(
      `${base}v3/conversations/${activity.conversation.id}/activities`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    return;
  }

  const aadObjectId = activity?.from?.aadObjectId;
  const message = activity?.text ?? "";
  const conversationId = activity?.conversation?.id;
  const conversationType =
    activity?.conversation?.conversationType || "personal"; // "personal" | "groupChat" | "channel"

  const user = await getUserByAadObjectId(aadObjectId);
  let text;

  //If we don't find a user we'll send a reply back saying the user wasn't found
  if (!user) {
    text = "No User found!";
  } else {
    const assistant = await getAssistantById(user.assistant_id);
    const channel = "teams";
    let thread;

    if (conversationType === "personal") {
      // 1:1 chat with the bot → scope=user
      thread = await getUserThreadForChannel({
        userId: user.id,
        assistantId: assistant.id,
        channel,
      });

      if (!thread) {
        const aiThread = await createOAiThread();
        thread = await createThread({
          userId: user.id,
          assistantId: assistant.id,
          aiThreadId: aiThread.id,
          channel,
          scope: "user",
          externalConversationId: conversationId,
        });
      }
    } else {
      // groupChat or channel → scope=group
      thread = await getGroupThreadForConversation({
        assistantId: assistant.id,
        channel,
        externalConversationId: conversationId,
      });

      if (!thread) {
        const aiThread = await createOAiThread();
        thread = await createThread({
          userId: null, // group-scoped, not owned by a single user
          assistantId: assistant.id,
          aiThreadId: aiThread.id,
          channel,
          scope: "group",
          externalConversationId: conversationId,
        });
      }
    }

    if (!thread?.ai_thread_id) {
      console.error("[TEAMS] Thread has no ai_thread_id:", thread);
      throw new Error("Thread is missing ai_thread_id");
    }

    const aiThreadId = thread.ai_thread_id;

    // TODO: record user message in your messages table if you want
    await createMessage({
      threadId: thread.id,
      userId: user.id, // the AAD user
      messageId: activity.id, // Teams activity id
      externalContactId: activity.from.id, // Teams user id, if you care
      content: message,
      role: "user",
    });

    const aiResponse = await sendMessageToAi(
      assistant.open_ai_id,
      message,
      aiThreadId,
    );

    text = aiResponse.aiResponse;

    // TODO: record assistant message as well
    await createMessage({
      threadId: thread.id,
      userId: user.id, // up to you: same as sender or null
      messageId: null, // or the id returned from send
      externalContactId: null,
      content: text, // AI answer
      role: "assistant",
    });
  }

  //URL gotten from the activity to make the api call to send back a message
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
    },
  );

  if (!res.ok) {
    console.error("Failed to send reply: ", res.status, await res.text());
  }
}

function GetTenantId(activity) {
  return (
    activity?.channelData?.tenant?.id ||
    activity?.conversation?.tenantId ||
    null
  );
}

function GetFromId(activity) {
  return activity?.from?.id || null;
}

function GetAadObjectId(activity) {
  return activity?.from?.aadObjectId || null;
}

function GetConversationType(activity) {
  return activity?.conversation?.conversationType || "personal";
}

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
      "Something went wrong, please contact the developers of MyDigitalBot.",
    ).catch((e) => console.error("sendReply error: ", e));
    return;
  }
  const org = await getOrganizationByTeamsTenantId(tenantId);
  if (!org) {
    await sendReply(
      activity,
      "This Microsoft Teams Tenant is not registered for MyDigitalBot yet. Please ask your admin to register the organization at MyDigitalBot.com. Also you can type --help for more help.",
    );
    return;
  }

  let user = await getUserByAadObjectId(aadObjectId);

  if (!user) {
    console.warn("[TEAMS install] No user found for AAD:", aadObjectId);
    //TODO: Send message to user that their ID hasn't been added to MyDigitalBot and give out the conversationID
    sendReply(
      activity,
      `Your ID was not found on any of MyDigitalBot's users, please contact your admin so they can make the link manually or retry after making sure the ID is set. Your ID:${aadObjectId}, Conversation ID:${conversationId}, From ID:${teamsUserId}`,
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
    console.error("sendReply error: ", e),
  );
}

export async function POST(req) {
  const activity = await req.json();

  if (activity.type === "message" && activity.text) {
    // sendReply(activity, `Echo: ${activity.text}`).catch((e) =>
    //   console.error("sendReply error: ", e)
    // );
    await handleUserInteraction(activity);
  }

  // if (activity.type === "conversationUpdate") {
  //   console.log(activity);
  // }

  if (activity.type === "installationUpdate" && activity.action === "add") {
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

  return NextResponse.json({ status: 200 });
}
