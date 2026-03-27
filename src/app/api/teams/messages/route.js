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
import {
  createThread,
  getUserThreadForChannel,
  getGroupThreadForConversation,
} from "@/lib/repos/threads.repo";
import {
  upsertTeamsInstallation,
  getTeamsInstallationByConversation,
} from "@/lib/repos/teamsInstallations.repo";
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

  await upsertTeamsInstallation({
    organization_id: org.id,
    assistant_id: user.assistant_id,
    scope: "user",
    user_id: user.id,
    tenant_id: tenantId,
    service_url: serviceUrl,
    conversation_id: conversationId,
    conversation_type: conversationType,
    teams_user_id: fromId,
    last_seen_at: new Date().toISOString(),
  });

  await updateUser(user.id, { teamsFromId: fromId }).catch(() => {});

  return "Connected! You can now use the bot normally";
}

//TODO: Make the user register their AAD OBJECT ID with the email address
async function cmdReconnect(args, activity) {
  const tenantId = GetTenantId(activity);
  const aadObjectId = GetAadObjectId(activity);
  const fromId = GetFromId(activity);

  const conversationId = activity?.conversation?.id || null;
  const serviceUrl = activity?.serviceUrl || null;
  const conversationType = GetConversationType(activity);

  const email = Array.isArray(args)
    ? (args[0] || "").trim()
    : String(args || "").trim();

  if (!tenantId) return `Couldn't read the Tenant ID from this message.`;
  if (!email) return `Usage: --reconnect email@example.com`;
  if (!aadObjectId || !fromId)
    return `I don't have access to your Teams IDs right now.`;
  if (!conversationId || !serviceUrl)
    return `Missing conversationId/serviceUrl. Try again in a 1:1 chat.`;

  // Find the target user by email
  let userRef;
  try {
    userRef = await getUserByEmail(email, tenantId);
  } catch (err) {
    if (err.code === "AMBIGUOUS_EMAIL_TENANT") {
      return `That email exists multiple times in this tenant. Ask your admin to fix duplicates.`;
    }
    throw err;
  }

  const userId = typeof userRef === "object" ? userRef?.id : userRef;
  if (!userId) return `No user found for ${email} in this tenant.`;

  // SAFETY: if this AAD is already linked to another user, don't overwrite
  const alreadyLinked = await getUserByAadObjectId(aadObjectId);
  if (alreadyLinked && alreadyLinked.id !== userId) {
    return `This Teams account is already linked to another user in MyDigitalBot. Ask your admin to fix it.`;
  }

  // Update user link (safe now)
  await updateUser(userId, {
    teamsAadObjectId: aadObjectId,
    teamsFromId: fromId,
  });

  // Get org for installation upsert
  const org = await getOrganizationByTeamsTenantId(tenantId);
  if (!org) return `Your organization isn't registered in MyDigitalBot.com.`;

  const fullUser = await getUserById(userId);

  // ✅ New source of truth
  await upsertTeamsInstallation({
    organization_id: org.id,
    assistant_id: fullUser.assistant_id,
    scope: "user",
    user_id: userId,
    tenant_id: tenantId,
    service_url: serviceUrl,
    conversation_id: conversationId,
    conversation_type: conversationType,
    teams_user_id: fromId,
    last_seen_at: new Date().toISOString(),
  });

  // Optional: if you still keep legacy user_teams_conversation
  // await upsertUserTeamsConversation({
  //   userId,
  //   teamsUserId: fromId,
  //   conversationId,
  //   serviceUrl,
  //   tenantId,
  //   conversationType,
  // });

  return `Linked Teams to ${email} and connected this conversation ✅`;
}

async function cmdCreateUser(args, activity) {
  const tenantId = GetTenantId(activity);
  const aadObjectId = GetAadObjectId(activity);
  const fromId = GetFromId(activity);

  const conversationId = activity?.conversation?.id || null;
  const serviceUrl = activity?.serviceUrl || null;
  const conversationType = GetConversationType(activity);

  const email = Array.isArray(args)
    ? (args[0] || "").trim()
    : String(args || "").trim();

  if (!tenantId) return `Couldn't read the Tenant ID from this message.`;
  if (!email) return `Usage: --register email@example.com`;
  if (!aadObjectId || !fromId)
    return `I don't have access to your Teams IDs right now.`;
  if (!conversationId || !serviceUrl)
    return `Missing conversationId/serviceUrl. Try again in a 1:1 chat.`;

  const org = await getOrganizationByTeamsTenantId(tenantId);
  if (!org)
    return `Your organization isn't registered in MyDigitalBot.com. Ask your admin.`;

  // 1) If this Teams account is already linked, just connect (DON'T create)
  const existingByAad = await getUserByAadObjectId(aadObjectId);
  if (existingByAad) {
    await upsertTeamsInstallation({
      organization_id: org.id,
      assistant_id: existingByAad.assistant_id,
      scope: "user",
      user_id: existingByAad.id,
      tenant_id: tenantId,
      service_url: serviceUrl,
      conversation_id: conversationId,
      conversation_type: conversationType,
      teams_user_id: fromId,
      last_seen_at: new Date().toISOString(),
    });

    await updateUser(existingByAad.id, { teamsFromId: fromId }).catch(() => {});
    return `Obrigado por se registar na MyDigitalBot.<br>Agora poderás receber comunicações da Empresa e interagir com o teu Assistente Virtual.`;
  }

  // 2) If the email already exists in this tenant, link it (register behaves like reconnect)
  let userRefByEmail = null;
  try {
    userRefByEmail = await getUserByEmail(email, tenantId);
  } catch (err) {
    if (err.code === "AMBIGUOUS_EMAIL_TENANT") {
      return `Este email: ${email} já existe em duplicado na aplicação, por favor pede ao administrador para remover os duplicados.`;
    }
    throw err;
  }

  const userIdByEmail =
    typeof userRefByEmail === "object" ? userRefByEmail?.id : userRefByEmail;

  if (userIdByEmail) {
    // link Teams IDs
    await updateUser(userIdByEmail, {
      teamsAadObjectId: aadObjectId,
      teamsFromId: fromId,
    });

    const fullUser = await getUserById(userIdByEmail);

    await upsertTeamsInstallation({
      organization_id: org.id,
      assistant_id: fullUser.assistant_id,
      scope: "user",
      user_id: userIdByEmail,
      tenant_id: tenantId,
      service_url: serviceUrl,
      conversation_id: conversationId,
      conversation_type: conversationType,
      teams_user_id: fromId,
      last_seen_at: new Date().toISOString(),
    });

    return `Conta encontrada para ${email} ✅ Teams ligado e conversa conectada.`;
  }

  // 3) Otherwise create a brand new user (safe: no AAD conflict)
  const assistant = await getFirstAssistantInOrg(org.id);

  const newUser = await createUser({
    organizationId: org.id,
    phoneNumber: null,
    phoneCountryCode: null,
    phoneNational: null,
    name: activity?.from?.name,
    email,
    assistantId: assistant.id,
    teamsAadObjectId: aadObjectId,
    teamsFromId: fromId,
  });

  await upsertTeamsInstallation({
    organization_id: org.id,
    assistant_id: newUser.assistant_id,
    scope: "user",
    user_id: newUser.id,
    tenant_id: tenantId,
    service_url: serviceUrl,
    conversation_id: conversationId,
    conversation_type: conversationType,
    teams_user_id: fromId,
    last_seen_at: new Date().toISOString(),
  });

  return `Obrigado por se registar na MyDigitalBot.<br>Agora poderás receber comunicações da Empresa e interagir com o teu Assistente Virtual.`;
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
      text = `--help: Lista de Comandos<br>--status: Verificar o estado do MyDigitalBot<br>--whoami: Mostra os teus IDs do Teams<br>--reconnect: Voltar a ligar ao banco de dados<br>--register email@example.com: Registo na MyDigitalBot, escrevendo o comando e de seguida o endereço de e-mail`;

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
    case "send":
      text = `Bem-vindo à aplicação MyDigitalBot.<br>Para começares a usar a aplicação, regista-te escrevendo --register e depois o teu email.<br>Exemplo: --register nome@email.pt<br>Para mais opções, escreve --help`;
      return text;
    default:
      return `Comando desconhecido: ${cmd.command}<br>Tenta --help`;
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
      text: "Parece que o teu tenant não está registado e por causa disso não consegues utilizar este serviço.<br>Por favor vai a MyDigitalBot.com e regista a tua organização.",
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
    text = `De momento não estás inscrito na aplicação.<br>Para começares a usar a aplicação, regista-te escrevendo --register e depois o teu email. <br>Exemplo: --register nome@email.pt<br><br>Para mais opções, escreve: --help`;
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
      "Este Tenant da Microsoft Teams não está registado em MyDigitalBot. Por favor contacta o teu administrador para registar esta Organização em MyDigitalBot.com.<br>Para mais ajuda escreve --help.",
    );
    return;
  }

  let user = await getUserByAadObjectId(aadObjectId);

  if (!user) {
    console.warn("[TEAMS install] No user found for AAD:", aadObjectId);
    //TODO: Send message to user that their ID hasn't been added to MyDigitalBot and give out the conversationID
    sendReply(
      activity,
      `Bem-vindo à aplicação MyDigitalBot.<br>Para começares a usar a aplicação, regista-te escrevendo --register e depois o teu email.<br>Exemplo:<br>--register nome@email.pt<br><br>Para mais opções, escreve:<br>--help`,
    ).catch((e) => console.error("sendReply error: ", e));
    return;
  }

  await upsertTeamsInstallation({
    organization_id: org.id,
    assistant_id: user.assistant_id,
    scope: "user",
    user_id: user.id,
    tenant_id: tenantId,
    service_url: serviceUrl,
    conversation_id: conversationId,
    conversation_type: conversationType,
    teams_user_id: teamsUserId,
    last_seen_at: new Date().toISOString(),
  });

  try {
    if (user.teams_from_id !== teamsUserId) {
      await updateUser(user.id, { teamsFromId: teamsUserId });
    }
  } catch (err) {
    console.error(
      "[TEAMS] Failed to sync teamsFromId after installation upsert",
      {
        userId: user.id,
        teamsUserId,
        installationId: installation?.id,
        err,
      },
    );
  }

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

async function handleGroupInstallation(activity) {
  // console.log(activity);
  const tenantId = GetTenantId(activity);
  const serviceUrl = activity?.serviceUrl || null;
  const conversationId = activity?.conversation?.id || null;
  const conversationType = GetConversationType(activity); // channel | groupChat

  // Team/channel metadata (only present for "channel")
  const teamAadGroupId = activity?.channelData?.team?.aadGroupId || null;
  const teamId = activity?.channelData?.team?.id || null;
  const channelId = activity?.channelData?.channel?.id || null;

  if (!tenantId || !serviceUrl || !conversationId) {
    console.warn("[TEAMS group install] Missing fields:", {
      tenantId,
      serviceUrl,
      conversationId,
      conversationType,
    });
    return;
  }

  const org = await getOrganizationByTeamsTenantId(tenantId);
  if (!org) {
    await sendReply(
      activity,
      "This tenant isn't registered in MyDigitalBot.com yet. Ask your admin to register it.",
    );
    return;
  }

  const defaultAssistant = await getFirstAssistantInOrg(org.id);

  await upsertTeamsInstallation({
    organization_id: org.id,
    assistant_id: defaultAssistant.id,
    scope: "group",
    user_id: null,
    tenant_id: tenantId,
    service_url: serviceUrl,
    conversation_id: conversationId,
    conversation_type: conversationType,
    teams_user_id: null,
    team_aad_group_id: teamAadGroupId,
    team_id: teamId,
    channel_id: channelId,
    last_seen_at: new Date().toISOString(),
  });

  const channel = "teams";
  let thread = await getGroupThreadForConversation({
    assistantId: defaultAssistant.id,
    channel,
    externalConversationId: conversationId,
  });

  if (!thread) {
    const aiThread = await createOAiThread();
    thread = await createThread({
      userId: null,
      assistantId: defaultAssistant.id,
      aiThreadId: aiThread.id,
      channel,
      scope: "group",
      externalConversationId: conversationId,
    });
  }

  await sendReply(
    activity,
    conversationType === "channel"
      ? "Installed in this channel. Mention me (@MyDigitalBot) to talk."
      : "Installed in this group chat. Mention me (@MyDigitalBot) to talk.",
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
    if (activity.conversation?.isGroup) {
      await handleGroupInstallation(activity);
    } else {
      await handleUserInstallation(activity);
    }
  }

  if (activity.type === "installationUpdate" && activity.action === "remove") {
    // console.log("[UNINSTALL] ", activity);
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
