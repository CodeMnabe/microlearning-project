// /src/app/api/teams/messages/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { getAssistantById } from "@/lib/repos/assistants.repo";
import { createOAiThread, sendMessageToAi } from "@/lib/services/oAi.services";
import {
  getOrganization,
  getOrganizationByTeamsTenantId,
} from "@/lib/repos/organizations.repo";
import { createMessage } from "@/lib/repos/messages.repo";

import {
  getUserByAadObjectId,
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

async function handleUserInteraction(activity) {
  const tenantHint = activity?.channelData?.tenant?.id;
  const org = await getOrganizationByTeamsTenantId(tenantHint);

  const token = await getBotToken(tenantHint);

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
      }
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
      aiThreadId
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
    }
  );

  if (!res.ok) {
    console.error("Failed to send reply: ", res.status, await res.text());
  }
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
    // sendReply(activity, `Echo: ${activity.text}`).catch((e) =>
    //   console.error("sendReply error: ", e)
    // );
    await handleUserInteraction(activity);
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
