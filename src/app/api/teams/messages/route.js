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
  getOrganizationByTeamsTenantId,
} from "@/lib/repos/organizations.repo";
import { createMessage } from "@/lib/repos/messages.repo";

import {
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
} from "@/lib/repos/teamsInstallations.repo";
import { getBotToken } from "@/lib/teams/auth";

import {
  handleApiError,
  requireValidTeamsRequest,
} from "@/lib/auth/guards";

function userBelongsToOrganization(user, organizationId) {
  if (!user || !organizationId) return false;

  return (
    Number(user.organization_id) ===
    Number(organizationId)
  );
}

function assistantBelongsToOrganization(assistant, organizationId) {
  if (!assistant || !organizationId) return false;

  const assistantOrganizationId =
    assistant.organization_id ?? assistant.org_id ?? null;

  return (
    Number(assistantOrganizationId) ===
    Number(organizationId)
  );
}

async function getTeamsUserForOrganization({
  aadObjectId,
  organizationId,
}) {
  if (!aadObjectId || !organizationId) {
    return null;
  }

  const user = await getUserByAadObjectId(
    aadObjectId,
  );

  if (!user) return null;

  if (
    !userBelongsToOrganization(
      user,
      organizationId,
    )
  ) {
    console.warn(
      "[TEAMS] AAD user organization mismatch",
      {
        aadObjectId,
        expectedOrganizationId:
          organizationId,
        actualOrganizationId:
          user.organization_id,
        userId: user.id,
      },
    );

    return null;
  }

  return user;
}

async function assertAssistantMatchesOrganization(
  assistant,
  organizationId,
) {
  const assistantOrganizationId =
    assistant?.organization_id ?? assistant?.org_id ?? null;

  if (
    !assistant ||
    Number(assistantOrganizationId) !==
      Number(organizationId)
  ) {
    const error = new Error(
      "Assistant does not belong to the Teams organization",
    );

    error.status = 403;
    throw error;
  }

  return assistant;
}

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
  const tenantId = GetTenantId(activity);
  const aadObjectId = GetAadObjectId(activity);
  const fromId = GetFromId(activity);

  return [
    `Tenant ID: ${tenantId || "-"}`,
    `From Id: ${fromId || "-"}`,
    `Aad Object Id: ${aadObjectId || "-"}`,
  ].join("<br>");
}

async function cmdConnect(activity) {
  const tenantId = GetTenantId(activity);
  const aadObjectId = GetAadObjectId(activity);
  const fromId = GetFromId(activity);

  const conversationId =
    activity?.conversation?.id || null;

  const serviceUrl =
    activity?.serviceUrl || null;

  const conversationType =
    GetConversationType(activity);

  if (!tenantId) {
    return "The Tenant Id couldn't be detected. Please try again or contact support.";
  }

  const org =
    await getOrganizationByTeamsTenantId(
      tenantId,
    );

  if (!org) {
    return "Your organization isn't registered in MyDigitalBot.com. Ask your admin or register it first.";
  }

  if (
    !aadObjectId ||
    !fromId ||
    !conversationId ||
    !serviceUrl
  ) {
    return [
      "I'm missing required data to connect your account",
      `AAD Object ID: ${aadObjectId || "-"}`,
      `Teams User ID: ${fromId || "-"}`,
      `Conversation ID: ${conversationId || "-"}`,
      `ServiceUrl: ${serviceUrl || "-"}`,
    ].join("<br>");
  }

  const user =
    await getTeamsUserForOrganization({
      aadObjectId,
      organizationId: org.id,
    });

  if (!user) {
    return [
      "You're not linked to a MyDigitalBot user in this organization.",
      "Send this to your admin so they can check the account:",
      `Tenant ID: ${tenantId}`,
      `AAD Object ID: ${aadObjectId}`,
    ].join("<br>");
  }

  const assistant =
    await getAssistantById(
      user.assistant_id,
    );

  await assertAssistantMatchesOrganization(
    assistant,
    org.id,
  );

  await upsertTeamsInstallation({
    organization_id: org.id,
    assistant_id: assistant.id,
    scope: "user",
    user_id: user.id,
    tenant_id: tenantId,
    service_url: serviceUrl,
    conversation_id: conversationId,
    conversation_type: conversationType,
    teams_user_id: fromId,
    last_seen_at: new Date().toISOString(),
  });

  await updateUser(user.id, {
    teamsFromId: fromId,
  }).catch(() => {});

  return "Connected! You can now use the bot normally";
}

async function cmdCreateUser(args, activity) {
  const tenantId = GetTenantId(activity);
  const aadObjectId = GetAadObjectId(activity);
  const fromId = GetFromId(activity);

  const conversationId =
    activity?.conversation?.id || null;

  const serviceUrl =
    activity?.serviceUrl || null;

  const conversationType =
    GetConversationType(activity);

  const email = Array.isArray(args)
    ? (args[0] || "").trim()
    : String(args || "").trim();

  if (!tenantId) {
    return "Couldn't read the Tenant ID from this message.";
  }

  if (!email) {
    return "Usage: --register email@example.com";
  }

  if (!aadObjectId || !fromId) {
    return "I don't have access to your Teams IDs right now.";
  }

  if (!conversationId || !serviceUrl) {
    return "Missing conversationId/serviceUrl. Try again in a 1:1 chat.";
  }

  const org =
    await getOrganizationByTeamsTenantId(
      tenantId,
    );

  if (!org) {
    return "Your organization isn't registered in MyDigitalBot.com. Ask your admin.";
  }

  const existingByAad =
    await getUserByAadObjectId(
      aadObjectId,
    );

  if (existingByAad) {
    if (
      !userBelongsToOrganization(
        existingByAad,
        org.id,
      )
    ) {
      return (
        "This Teams account is already linked " +
        "to a user in another organization. " +
        "Ask your administrator to correct the link."
      );
    }

    const assistant =
      await getAssistantById(
        existingByAad.assistant_id,
      );

    await assertAssistantMatchesOrganization(
      assistant,
      org.id,
    );

    await upsertTeamsInstallation({
      organization_id: org.id,
      assistant_id: assistant.id,
      scope: "user",
      user_id: existingByAad.id,
      tenant_id: tenantId,
      service_url: serviceUrl,
      conversation_id: conversationId,
      conversation_type: conversationType,
      teams_user_id: fromId,
      last_seen_at: new Date().toISOString(),
    });

    await updateUser(existingByAad.id, {
      teamsFromId: fromId,
    }).catch(() => {});

    return (
      "Obrigado por se registar na MyDigitalBot.<br>" +
      "Agora poderás receber comunicações da Empresa e " +
      "interagir com o teu Assistente Virtual."
    );
  }

  let userRefByEmail = null;

  try {
    userRefByEmail =
      await getUserByEmail(
        email,
        tenantId,
      );
  } catch (error) {
    if (
      error.code ===
      "AMBIGUOUS_EMAIL_TENANT"
    ) {
      return (
        `Este email: ${email} já existe em duplicado ` +
        "na aplicação, por favor pede ao administrador " +
        "para remover os duplicados."
      );
    }

    throw error;
  }

  const userIdByEmail =
    typeof userRefByEmail === "object"
      ? userRefByEmail?.id
      : userRefByEmail;

  if (userIdByEmail) {
    const fullUser =
      await getUserById(
        userIdByEmail,
      );

    if (
      !userBelongsToOrganization(
        fullUser,
        org.id,
      )
    ) {
      return (
        "The email belongs to a user in another organization. " +
        "Ask your administrator to correct the account."
      );
    }

    const assistant =
      await getAssistantById(
        fullUser.assistant_id,
      );

    await assertAssistantMatchesOrganization(
      assistant,
      org.id,
    );

    const alreadyLinked =
      await getUserByAadObjectId(
        aadObjectId,
      );

    if (
      !alreadyLinked ||
      Number(alreadyLinked.id) !== Number(userIdByEmail)
    ) {
      return (
        "For security, an existing account can only be connected after " +
        "an administrator has linked this Teams identity to it."
      );
    }

    await updateUser(userIdByEmail, {
      teamsAadObjectId: aadObjectId,
      teamsFromId: fromId,
    });

    await upsertTeamsInstallation({
      organization_id: org.id,
      assistant_id: assistant.id,
      scope: "user",
      user_id: userIdByEmail,
      tenant_id: tenantId,
      service_url: serviceUrl,
      conversation_id: conversationId,
      conversation_type: conversationType,
      teams_user_id: fromId,
      last_seen_at: new Date().toISOString(),
    });

    return (
      `Conta encontrada para ${email}. ` +
      "Teams ligado e conversa conectada."
    );
  }

  return (
    "No pre-provisioned account was found. Ask an administrator to " +
    "create the account and link this Teams identity before registering."
  );
}

async function cmdReconnect(args, activity) {
  const tenantId = GetTenantId(activity);
  const aadObjectId = GetAadObjectId(activity);
  const fromId = GetFromId(activity);

  const conversationId =
    activity?.conversation?.id || null;

  const serviceUrl =
    activity?.serviceUrl || null;

  const conversationType =
    GetConversationType(activity);

  const email = Array.isArray(args)
    ? (args[0] || "").trim()
    : String(args || "").trim();

  if (!tenantId) {
    return "Couldn't read the Tenant ID from this message.";
  }

  if (!email) {
    return "Usage: --reconnect email@example.com";
  }

  if (!aadObjectId || !fromId) {
    return "I don't have access to your Teams IDs right now.";
  }

  if (!conversationId || !serviceUrl) {
    return "Missing conversationId/serviceUrl. Try again in a 1:1 chat.";
  }

  const org =
    await getOrganizationByTeamsTenantId(
      tenantId,
    );

  if (!org) {
    return "Your organization isn't registered in MyDigitalBot.com.";
  }

  let userRef;

  try {
    userRef = await getUserByEmail(
      email,
      tenantId,
    );
  } catch (error) {
    if (
      error.code ===
      "AMBIGUOUS_EMAIL_TENANT"
    ) {
      return "That email exists multiple times in this tenant. Ask your admin to fix duplicates.";
    }

    throw error;
  }

  const userId =
    typeof userRef === "object"
      ? userRef?.id
      : userRef;

  if (!userId) {
    return `No user found for ${email} in this tenant.`;
  }

  const fullUser =
    await getUserById(userId);

  if (
    !userBelongsToOrganization(
      fullUser,
      org.id,
    )
  ) {
    return (
      "The selected user does not belong to this organization. " +
      "Ask your administrator to correct the account."
    );
  }

  const alreadyLinked =
    await getUserByAadObjectId(
      aadObjectId,
    );

  if (
    !alreadyLinked ||
    String(alreadyLinked.id) !== String(userId)
  ) {
    return (
      "For security, an administrator must link this Teams identity " +
      "to the requested account before reconnecting it."
    );
  }

  const assistant =
    await getAssistantById(
      fullUser.assistant_id,
    );

  await assertAssistantMatchesOrganization(
    assistant,
    org.id,
  );

  await updateUser(userId, {
    teamsAadObjectId: aadObjectId,
    teamsFromId: fromId,
  });

  await upsertTeamsInstallation({
    organization_id: org.id,
    assistant_id: assistant.id,
    scope: "user",
    user_id: userId,
    tenant_id: tenantId,
    service_url: serviceUrl,
    conversation_id: conversationId,
    conversation_type: conversationType,
    teams_user_id: fromId,
    last_seen_at: new Date().toISOString(),
  });

  return `Linked Teams to ${email} and connected this conversation.`;
}

async function CheckForCommandMessage(
  activity,
) {
  const message =
    typeof activity?.text === "string"
      ? activity.text.trim()
      : "";

  if (!message) {
    return { isCommand: false };
  }

  const hasCommand = message.match(
    /^(--|\/|!)([a-z][\w-]*)(?:\s+(.+)|=(.+))?$/i,
  );

  if (!hasCommand) {
    return { isCommand: false };
  }

  const name =
    hasCommand[2].toLowerCase();

  const argString = (
    hasCommand[3] ??
    hasCommand[4] ??
    ""
  ).trim();

  const args = argString
    ? argString.split(/\s+/)
    : [];

  return {
    isCommand: true,
    command: name,
    argString,
    args,
  };
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
    case "register":
      return await cmdCreateUser(cmd.args, activity);
    case "send":
      text = `Bem-vindo à aplicação MyDigitalBot.<br>Para começares a usar a aplicação, regista-te escrevendo --register e depois o teu email.<br>Exemplo: --register nome@email.pt<br>Para mais opções, escreve --help`;
      return text;
    case "reconnect":
      return await cmdReconnect(
        cmd.args,
        activity,
      );
    default:
      return `Comando desconhecido: ${cmd.command}<br>Tenta --help`;
  }
}

async function handleUserInteraction(activity) {
  const cmd =
    await CheckForCommandMessage(activity);

  if (cmd.isCommand) {
    const text =
      await CheckCommands(cmd, activity);

    await sendReply(activity, text);
    return;
  }

  const tenantId = GetTenantId(activity);

  const org =
    await getOrganizationByTeamsTenantId(
      tenantId,
    );

  if (!org) {
    await sendReply(
      activity,
      "Parece que o teu tenant não está registado e por causa disso não consegues utilizar este serviço.<br>Por favor vai a MyDigitalBot.com e regista a tua organização.",
    );

    return;
  }

  const aadObjectId =
    GetAadObjectId(activity);

  const message =
    typeof activity?.text === "string"
      ? activity.text.trim()
      : "";

  const conversationId =
    activity?.conversation?.id || null;

  const conversationType =
    GetConversationType(activity);

  if (
    !aadObjectId ||
    !conversationId ||
    !message
  ) {
    await sendReply(
      activity,
      "Invalid Teams message.",
    );

    return;
  }

  const user =
    await getTeamsUserForOrganization({
      aadObjectId,
      organizationId: org.id,
    });

  let text;

  if (!user) {
    text =
      "De momento não estás inscrito nesta organização.<br>" +
      "Para começares a usar a aplicação, regista-te escrevendo " +
      "--register e depois o teu email.<br>" +
      "Exemplo: --register nome@email.pt<br><br>" +
      "Para mais opções, escreve: --help";
  } else {
    const assistant =
      await getAssistantById(
        user.assistant_id,
      );

    await assertAssistantMatchesOrganization(
      assistant,
      org.id,
    );

    const channel = "teams";
    let thread;

    if (conversationType === "personal") {
      thread =
        await getUserThreadForChannel({
          userId: user.id,
          assistantId: assistant.id,
          channel,
        });

      if (!thread) {
        const aiThread =
          await createOAiThread();

        thread = await createThread({
          userId: user.id,
          assistantId: assistant.id,
          aiThreadId: aiThread.id,
          channel,
          scope: "user",
          externalConversationId:
            conversationId,
        });
      }
    } else {
      thread =
        await getGroupThreadForConversation({
          assistantId: assistant.id,
          channel,
          externalConversationId:
            conversationId,
        });

      if (!thread) {
        const aiThread =
          await createOAiThread();

        thread = await createThread({
          userId: null,
          assistantId: assistant.id,
          aiThreadId: aiThread.id,
          channel,
          scope: "group",
          externalConversationId:
            conversationId,
        });
      }
    }

    if (!thread?.ai_thread_id) {
      throw new Error(
        "Thread is missing ai_thread_id",
      );
    }

    if (
      Number(thread.assistant_id) !==
      Number(assistant.id)
    ) {
      const error = new Error(
        "Thread does not belong to the selected assistant",
      );

      error.status = 403;
      throw error;
    }

    await createMessage({
      threadId: thread.id,
      userId: user.id,
      messageId: activity.id,
      externalContactId:
        activity?.from?.id || null,
      content: message,
      role: "user",
    });

    const aiResponse =
      await sendMessageToAi(
        assistant.open_ai_id,
        message,
        thread.ai_thread_id,
      );

    text = aiResponse.aiResponse;

    await createMessage({
      threadId: thread.id,
      userId: user.id,
      messageId: null,
      externalContactId: null,
      content: text,
      role: "assistant",
    });
  }

  await sendReply(activity, text);
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

async function handleUserInstallation(
  activity,
) {
  const aadObjectId =
    GetAadObjectId(activity);

  const tenantId =
    GetTenantId(activity);

  const teamsUserId =
    GetFromId(activity);

  const conversationId =
    activity?.conversation?.id || null;

  const serviceUrl =
    activity?.serviceUrl || null;

  const conversationType =
    GetConversationType(activity);

  if (
    !aadObjectId ||
    !teamsUserId ||
    !conversationId ||
    !serviceUrl ||
    !tenantId
  ) {
    console.warn(
      "[TEAMS install] Missing required fields",
      {
        aadObjectId,
        teamsUserId,
        conversationId,
        serviceUrl,
        tenantId,
      },
    );

    await sendReply(
      activity,
      "Something went wrong, please contact the developers of MyDigitalBot.",
    );

    return;
  }

  const org =
    await getOrganizationByTeamsTenantId(
      tenantId,
    );

  if (!org) {
    await sendReply(
      activity,
      "Este Tenant da Microsoft Teams não está registado em MyDigitalBot. Por favor contacta o teu administrador para registar esta Organização em MyDigitalBot.com.<br>Para mais ajuda escreve --help.",
    );

    return;
  }

  const user =
    await getTeamsUserForOrganization({
      aadObjectId,
      organizationId: org.id,
    });

  if (!user) {
    await sendReply(
      activity,
      "Bem-vindo à aplicação MyDigitalBot.<br>Para começares a usar a aplicação, regista-te escrevendo --register e depois o teu email.<br>Exemplo:<br>--register nome@email.pt<br><br>Para mais opções, escreve:<br>--help",
    );

    return;
  }

  const assistant =
    await getAssistantById(
      user.assistant_id,
    );

  await assertAssistantMatchesOrganization(
    assistant,
    org.id,
  );

  await upsertTeamsInstallation({
    organization_id: org.id,
    assistant_id: assistant.id,
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
    if (
      user.teams_from_id !==
      teamsUserId
    ) {
      await updateUser(user.id, {
        teamsFromId: teamsUserId,
      });
    }
  } catch (error) {
    console.error(
      "[TEAMS] Failed to sync teamsFromId",
      {
        userId: user.id,
        teamsUserId,
        error,
      },
    );
  }

  await sendReply(
    activity,
    "Conversation successfully connected.",
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

  const defaultAssistant =
    await getFirstAssistantInOrg(org.id);

  if (!defaultAssistant) {
    throw new Error(
      "Organization does not have an assistant",
    );
  }

  if (!assistantBelongsToOrganization(defaultAssistant, org.id)) {
    const error = new Error(
      "Assistant does not belong to the Teams organization",
    );

    error.status = 403;
    throw error;
  }

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

  if (!thread?.ai_thread_id) {
    throw new Error("Group thread is missing ai_thread_id");
  }

  if (Number(thread.assistant_id) !== Number(defaultAssistant.id)) {
    const error = new Error(
      "Group thread does not belong to the selected assistant",
    );

    error.status = 403;
    throw error;
  }

  if (thread.scope && thread.scope !== "group") {
    const error = new Error(
      "Teams group conversation resolved to a non-group thread",
    );

    error.status = 409;
    throw error;
  }

  await sendReply(
    activity,
    conversationType === "channel"
      ? "Installed in this channel. Mention me (@MyDigitalBot) to talk."
      : "Installed in this group chat. Mention me (@MyDigitalBot) to talk.",
  );
}

export async function POST(req) {
  try {
    let activity;

    try {
      activity = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    if (
      !activity ||
      typeof activity !== "object" ||
      Array.isArray(activity)
    ) {
      return NextResponse.json(
        { error: "Invalid Teams activity" },
        { status: 400 },
      );
    }

    const teamsAuth = await requireValidTeamsRequest(req, activity);

    if (teamsAuth.error) {
      return teamsAuth.error;
    }

    if (
      activity.type === "message" &&
      typeof activity.text === "string" &&
      activity.text.trim()
    ) {
      await handleUserInteraction(activity);
    }

    if (
      activity.type ===
        "installationUpdate" &&
      activity.action === "add"
    ) {
      const conversationType =
        GetConversationType(activity);

      if (
        conversationType === "channel" ||
        conversationType === "groupChat" ||
        activity.conversation?.isGroup ===
          true
      ) {
        await handleGroupInstallation(
          activity,
        );
      } else {
        await handleUserInstallation(
          activity,
        );
      }
    }

    return NextResponse.json(
      { ok: true },
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(
      error,
      "Failed to process Teams message",
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 200,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, OPTIONS",
    },
  });
}
