// /src/app/api/teams/messages/route.js

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  getAssistantById,
  getFirstAssistantInOrg,
} from "@/lib/repos/assistants.repo";

import {
  createConversation,
  generateAssistantResponse,
} from "@/lib/services/openaiResponses.service";

import { getOrganizationByTeamsTenantId } from "@/lib/repos/organizations.repo";

import { createMessage, getMessagesInThread } from "@/lib/repos/messages.repo";

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
  setThreadConversationId,
} from "@/lib/repos/threads.repo";

import {
  upsertTeamsInstallation,
  getTeamsInstallationByConversation,
} from "@/lib/repos/teamsInstallations.repo";

import { getBotToken } from "@/lib/teams/auth";

import { handleApiError, requireValidTeamsRequest } from "@/lib/auth/guards";

/* =========================================================
   ORGANIZATION SECURITY
   ========================================================= */

function userBelongsToOrganization(user, organizationId) {
  if (!user || !organizationId) {
    return false;
  }

  return Number(user.organization_id) === Number(organizationId);
}

function assistantBelongsToOrganization(assistant, organizationId) {
  if (!assistant || !organizationId) {
    return false;
  }

  const assistantOrganizationId =
    assistant.organization_id ?? assistant.org_id ?? null;

  return Number(assistantOrganizationId) === Number(organizationId);
}

async function getTeamsUserForOrganization({ aadObjectId, organizationId }) {
  if (!aadObjectId || !organizationId) {
    return null;
  }

  const user = await getUserByAadObjectId(aadObjectId);

  if (!user) {
    return null;
  }

  if (!userBelongsToOrganization(user, organizationId)) {
    console.warn("[TEAMS] AAD user organization mismatch", {
      aadObjectId,

      expectedOrganizationId: organizationId,

      actualOrganizationId: user.organization_id,

      userId: user.id,
    });

    return null;
  }

  return user;
}

async function assertAssistantMatchesOrganization(assistant, organizationId) {
  if (!assistantBelongsToOrganization(assistant, organizationId)) {
    const error = new Error(
      "Assistant does not belong to the Teams organization",
    );

    error.status = 403;

    throw error;
  }

  return assistant;
}

/* =========================================================
   SEND TEAMS REPLY
   ========================================================= */

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

    return {
      ok: false,
      error: "Missing serviceUrl/conversationId",
    };
  }

  const token = await getBotToken();

  const base = serviceUrl.endsWith("/") ? serviceUrl : `${serviceUrl}/`;

  const url = `${base}v3/conversations/${conversationId}/activities`;

  const payload = {
    type: "message",

    text: String(text ?? ""),

    ...(replyToId
      ? {
          replyToId,
        }
      : {}),
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

    return {
      ok: false,
      status: res.status,
      body,
    };
  }

  return {
    ok: true,
  };
}

/* =========================================================
   COMMANDS
   ========================================================= */

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

  const conversationId = activity?.conversation?.id ?? null;

  const serviceUrl = activity?.serviceUrl ?? null;

  const conversationType = GetConversationType(activity);

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

  const user = await getTeamsUserForOrganization({
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

  const assistant = await getAssistantById(user.assistant_id);

  await assertAssistantMatchesOrganization(assistant, org.id);

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

  const conversationId = activity?.conversation?.id ?? null;

  const serviceUrl = activity?.serviceUrl ?? null;

  const conversationType = GetConversationType(activity);

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

  const org = await getOrganizationByTeamsTenantId(tenantId);

  if (!org) {
    return "Your organization isn't registered in MyDigitalBot.com. Ask your admin.";
  }

  /*
   * Already linked Teams account.
   */
  const existingByAad = await getUserByAadObjectId(aadObjectId);

  if (existingByAad) {
    if (!userBelongsToOrganization(existingByAad, org.id)) {
      return (
        "This Teams account is already linked " +
        "to a user in another organization. " +
        "Ask your administrator to correct the link."
      );
    }

    const assistant = await getAssistantById(existingByAad.assistant_id);

    await assertAssistantMatchesOrganization(assistant, org.id);

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

  /*
   * Existing DB account.
   */
  let userRefByEmail = null;

  try {
    userRefByEmail = await getUserByEmail(email, tenantId);
  } catch (error) {
    if (error.code === "AMBIGUOUS_EMAIL_TENANT") {
      return (
        `Este email: ${email} já existe em duplicado ` +
        "na aplicação, por favor pede ao administrador " +
        "para remover os duplicados."
      );
    }

    throw error;
  }

  const userIdByEmail =
    typeof userRefByEmail === "object" ? userRefByEmail?.id : userRefByEmail;

  if (userIdByEmail) {
    const fullUser = await getUserById(userIdByEmail);

    if (!userBelongsToOrganization(fullUser, org.id)) {
      return (
        "The email belongs to a user in another organization. " +
        "Ask your administrator to correct the account."
      );
    }

    const assistant = await getAssistantById(fullUser.assistant_id);

    await assertAssistantMatchesOrganization(assistant, org.id);

    /*
     * Security:
     *
     * Don't allow somebody to claim another
     * existing account just by knowing its email.
     */
    const alreadyLinked = await getUserByAadObjectId(aadObjectId);

    if (!alreadyLinked || Number(alreadyLinked.id) !== Number(userIdByEmail)) {
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
      `Conta encontrada para ${email}. ` + "Teams ligado e conversa conectada."
    );
  }

  /*
   * Do NOT create arbitrary users through
   * the public Teams bot.
   */
  return (
    "No pre-provisioned account was found. Ask an administrator to " +
    "create the account and link this Teams identity before registering."
  );
}

async function cmdReconnect(args, activity) {
  const tenantId = GetTenantId(activity);

  const aadObjectId = GetAadObjectId(activity);

  const fromId = GetFromId(activity);

  const conversationId = activity?.conversation?.id ?? null;

  const serviceUrl = activity?.serviceUrl ?? null;

  const conversationType = GetConversationType(activity);

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

  const org = await getOrganizationByTeamsTenantId(tenantId);

  if (!org) {
    return "Your organization isn't registered in MyDigitalBot.com.";
  }

  let userRef;

  try {
    userRef = await getUserByEmail(email, tenantId);
  } catch (error) {
    if (error.code === "AMBIGUOUS_EMAIL_TENANT") {
      return "That email exists multiple times in this tenant. Ask your admin to fix duplicates.";
    }

    throw error;
  }

  const userId = typeof userRef === "object" ? userRef?.id : userRef;

  if (!userId) {
    return `No user found for ${email} in this tenant.`;
  }

  const fullUser = await getUserById(userId);

  if (!userBelongsToOrganization(fullUser, org.id)) {
    return (
      "The selected user does not belong to this organization. " +
      "Ask your administrator to correct the account."
    );
  }

  const alreadyLinked = await getUserByAadObjectId(aadObjectId);

  if (!alreadyLinked || String(alreadyLinked.id) !== String(userId)) {
    return (
      "For security, an administrator must link this Teams identity " +
      "to the requested account before reconnecting it."
    );
  }

  const assistant = await getAssistantById(fullUser.assistant_id);

  await assertAssistantMatchesOrganization(assistant, org.id);

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

async function CheckForCommandMessage(activity) {
  const message =
    typeof activity?.text === "string" ? activity.text.trim() : "";

  if (!message) {
    return {
      isCommand: false,
    };
  }

  const hasCommand = message.match(
    /^(--|\/|!)([a-z][\w-]*)(?:\s+(.+)|=(.+))?$/i,
  );

  if (!hasCommand) {
    return {
      isCommand: false,
    };
  }

  const name = hasCommand[2].toLowerCase();

  const argString = (hasCommand[3] ?? hasCommand[4] ?? "").trim();

  const args = argString ? argString.split(/\s+/) : [];

  return {
    isCommand: true,

    command: name,

    argString,

    args,
  };
}

async function CheckCommands(cmd, activity) {
  switch (cmd.command) {
    case "help":
      return `--help: Lista de Comandos<br>--status: Verificar o estado do MyDigitalBot<br>--whoami: Mostra os teus IDs do Teams<br>--reconnect: Voltar a ligar ao banco de dados<br>--register email@example.com: Registo na MyDigitalBot, escrevendo o comando e de seguida o endereço de e-mail`;

    case "status":
      return "Bot is active";

    case "whoami":
      return await cmdWhoAmI(activity);

    case "connect":
      return await cmdConnect(activity);

    case "register":
      return await cmdCreateUser(cmd.args, activity);

    case "reconnect":
      return await cmdReconnect(cmd.args, activity);

    case "send":
      return `Bem-vindo à aplicação MyDigitalBot.<br>Para começares a usar a aplicação, regista-te escrevendo --register e depois o teu email.<br>Exemplo: --register nome@email.pt<br>Para mais opções, escreve --help`;

    default:
      return `Comando desconhecido: ${cmd.command}<br>Tenta --help`;
  }
}

/* =========================================================
   OPENAI CONVERSATIONS
   ========================================================= */

function normalizeId(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const str = String(value).trim();

  return str.length ? str : null;
}

function buildConversationHistoryItems(messages = []) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message) => {
      const role = message?.role;

      const content = message?.content;

      return (
        (role === "user" || role === "assistant") &&
        typeof content === "string" &&
        content.trim()
      );
    })
    .slice(-20)
    .map((message) => ({
      type: "message",

      role: message.role,

      content: message.content.trim(),
    }));
}

async function ensureTeamsConversation({
  thread,
  userId,
  assistant,
  organizationId,
  channel,
  scope,
  externalConversationId,
}) {
  let currentThread = thread;

  let conversationId = normalizeId(currentThread?.openai_conversation_id);

  /*
   * =========================================================
   * BRAND NEW THREAD
   * =========================================================
   */
  if (!currentThread) {
    const conversation = await createConversation({
      assistantId: assistant.id,

      organizationId,

      userId,

      channel,

      scope,

      externalConversationId,
    });

    conversationId = normalizeId(conversation?.id);

    if (!conversationId) {
      throw new Error("OpenAI did not return a Conversation ID");
    }

    currentThread = await createThread({
      userId,

      assistantId: assistant.id,

      /*
       * Legacy Assistants API field.
       */
      aiThreadId: null,

      /*
       * New Responses/Conversations field.
       */
      openAiConversationId: conversationId,

      channel,

      scope,

      externalConversationId,
    });

    return {
      thread: currentThread,

      conversationId,
    };
  }

  /*
   * =========================================================
   * ALREADY MIGRATED
   * =========================================================
   */
  if (conversationId) {
    return {
      thread: currentThread,

      conversationId,
    };
  }

  /*
   * =========================================================
   * LEGACY ASSISTANTS API THREAD
   * =========================================================
   *
   * ai_thread_id = thread_...
   * openai_conversation_id = NULL
   */
  const previousMessages = await getMessagesInThread(currentThread.id);

  const historyItems = buildConversationHistoryItems(previousMessages);

  const conversation = await createConversation(
    {
      assistantId: assistant.id,

      organizationId,

      userId,

      channel,

      scope,

      externalConversationId,

      migratedFromDbThreadId: currentThread.id,
    },

    historyItems,
  );

  conversationId = normalizeId(conversation?.id);

  if (!conversationId) {
    throw new Error(
      `Could not migrate Teams thread ${currentThread.id} to an OpenAI Conversation`,
    );
  }

  currentThread = await setThreadConversationId(
    currentThread.id,
    conversationId,
  );

  console.log("[TEAMS] Migrated legacy thread to Conversation", {
    dbThreadId: currentThread.id,

    legacyAiThreadId: currentThread.ai_thread_id ?? null,

    conversationId,

    migratedMessages: historyItems.length,
  });

  return {
    thread: currentThread,

    conversationId,
  };
}

/* =========================================================
   NORMAL USER MESSAGE
   ========================================================= */

async function handleUserInteraction(activity) {
  const cmd = await CheckForCommandMessage(activity);

  if (cmd.isCommand) {
    const text = await CheckCommands(cmd, activity);

    await sendReply(activity, text);

    return;
  }

  const tenantId = GetTenantId(activity);

  const org = await getOrganizationByTeamsTenantId(tenantId);

  if (!org) {
    await sendReply(
      activity,
      "Parece que o teu tenant não está registado e por causa disso não consegues utilizar este serviço.<br>Por favor vai a MyDigitalBot.com e regista a tua organização.",
    );

    return;
  }

  const aadObjectId = GetAadObjectId(activity);

  const teamsConversationId = activity?.conversation?.id ?? null;

  const conversationType = GetConversationType(activity);

  const message =
    typeof activity?.text === "string" ? activity.text.trim() : "";

  if (!aadObjectId || !teamsConversationId || !message) {
    await sendReply(activity, "Invalid Teams message.");

    return;
  }

  /*
   * Resolve the user ONLY inside the tenant's
   * organization.
   */
  const user = await getTeamsUserForOrganization({
    aadObjectId,
    organizationId: org.id,
  });

  if (!user) {
    await sendReply(
      activity,
      "De momento não estás inscrito nesta organização.<br>Para começares a usar a aplicação, regista-te escrevendo --register e depois o teu email.<br>Exemplo: --register nome@email.pt<br><br>Para mais opções, escreve: --help",
    );

    return;
  }

  const channel = "teams";

  let assistantId = null;

  /*
   * Personal conversation:
   *
   * Assistant assigned to the user.
   */
  if (conversationType === "personal") {
    assistantId = user.assistant_id;
  } else {
    /*
     * Group/channel:
     *
     * Use the Assistant stored on this Teams
     * installation.
     */
    const installation = await getTeamsInstallationByConversation({
      tenantId,

      conversationId: teamsConversationId,

      organizationId: org.id,
    });

    if (
      installation &&
      installation.organization_id != null &&
      Number(installation.organization_id) !== Number(org.id)
    ) {
      const error = new Error(
        "Teams installation does not belong to this organization",
      );

      error.status = 403;

      throw error;
    }

    assistantId = installation?.assistant_id ?? null;

    /*
     * Existing installations should have an
     * Assistant. This fallback also keeps old
     * installations working during migration.
     */
    if (!assistantId) {
      const fallbackAssistant = await getFirstAssistantInOrg(org.id);

      assistantId = fallbackAssistant?.id ?? null;
    }
  }

  if (!assistantId) {
    throw new Error("No assistant is assigned to this Teams conversation");
  }

  /*
   * Supabase Assistant row.
   *
   * No OpenAI Assistant object exists anymore.
   */
  const assistant = await getAssistantById(assistantId);

  await assertAssistantMatchesOrganization(assistant, org.id);

  if (!assistant.model) {
    throw new Error(`Assistant ${assistant.id} has no model configured`);
  }

  /*
   * =========================================================
   * DB THREAD
   * =========================================================
   */
  let thread = null;

  let scope = null;

  if (conversationType === "personal") {
    scope = "user";

    thread = await getUserThreadForChannel({
      userId: user.id,

      assistantId: assistant.id,

      channel,
    });
  } else {
    scope = "group";

    thread = await getGroupThreadForConversation({
      assistantId: assistant.id,

      channel,

      externalConversationId: teamsConversationId,
    });
  }

  /*
   * Existing thread must belong to the same
   * Assistant.
   */
  if (thread && Number(thread.assistant_id) !== Number(assistant.id)) {
    const error = new Error("Thread does not belong to the selected assistant");

    error.status = 403;

    throw error;
  }

  if (thread && scope === "group" && thread.scope && thread.scope !== "group") {
    const error = new Error(
      "Teams group conversation resolved to a non-group thread",
    );

    error.status = 409;

    throw error;
  }

  /*
   * =========================================================
   * RESPONSES API CONVERSATION
   * =========================================================
   */
  const ensured = await ensureTeamsConversation({
    thread,

    userId: scope === "user" ? user.id : null,

    assistant,

    organizationId: org.id,

    channel,

    scope,

    externalConversationId: teamsConversationId,
  });

  thread = ensured.thread;

  const openAiConversationId = ensured.conversationId;

  if (!openAiConversationId) {
    throw new Error(
      `Teams thread ${thread?.id ?? "unknown"} has no OpenAI Conversation ID`,
    );
  }

  /*
   * Validate again after a new thread may
   * have been created.
   */
  if (Number(thread.assistant_id) !== Number(assistant.id)) {
    const error = new Error("Thread does not belong to the selected assistant");

    error.status = 403;

    throw error;
  }

  if (scope === "group" && thread.scope && thread.scope !== "group") {
    const error = new Error(
      "Teams group conversation resolved to a non-group thread",
    );

    error.status = 409;

    throw error;
  }

  /*
   * Save incoming Teams message locally.
   */
  await createMessage({
    threadId: thread.id,

    userId: user.id,

    organizationId: org.id,

    assistantId: assistant.id,

    channel,

    messageId: activity.id ?? null,

    externalContactId: activity?.from?.id ?? null,

    content: message,

    role: "user",
  });

  /*
   * =========================================================
   * RESPONSES API
   * =========================================================
   *
   * No:
   *
   * createOAiThread()
   * sendMessageToAi()
   * assistant.open_ai_id
   * beta.threads
   * runs
   * polling
   */
  const aiResponse = await generateAssistantResponse({
    assistant,

    conversationId: openAiConversationId,

    message,
  });

  const text = String(aiResponse?.aiResponse ?? "").trim();

  if (!text) {
    throw new Error("OpenAI returned an empty Teams response");
  }

  /*
   * Save Assistant response locally.
   */
  await createMessage({
    threadId: thread.id,

    userId: user.id,

    organizationId: org.id,

    assistantId: assistant.id,

    channel,

    messageId: null,

    externalContactId: null,

    content: text,

    role: "assistant",
  });

  await sendReply(activity, text);
}

/* =========================================================
   TEAMS ACTIVITY HELPERS
   ========================================================= */

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

/* =========================================================
   PERSONAL INSTALLATION
   ========================================================= */

async function handleUserInstallation(activity) {
  const aadObjectId = GetAadObjectId(activity);

  const tenantId = GetTenantId(activity);

  const teamsUserId = GetFromId(activity);

  const conversationId = activity?.conversation?.id ?? null;

  const serviceUrl = activity?.serviceUrl ?? null;

  const conversationType = GetConversationType(activity);

  if (
    !aadObjectId ||
    !teamsUserId ||
    !conversationId ||
    !serviceUrl ||
    !tenantId
  ) {
    console.warn("[TEAMS install] Missing required fields", {
      aadObjectId,
      teamsUserId,
      conversationId,
      serviceUrl,
      tenantId,
    });

    await sendReply(
      activity,
      "Something went wrong, please contact the developers of MyDigitalBot.",
    );

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

  const user = await getTeamsUserForOrganization({
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

  const assistant = await getAssistantById(user.assistant_id);

  await assertAssistantMatchesOrganization(assistant, org.id);

  const installation = await upsertTeamsInstallation({
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
    if (user.teams_from_id !== teamsUserId) {
      await updateUser(user.id, {
        teamsFromId: teamsUserId,
      });
    }
  } catch (error) {
    console.error("[TEAMS] Failed to sync teamsFromId", {
      userId: user.id,

      teamsUserId,

      installationId: installation?.id,

      error,
    });
  }

  await sendReply(activity, "Conversation successfully connected.");
}

/* =========================================================
   GROUP / CHANNEL INSTALLATION
   ========================================================= */

async function handleGroupInstallation(activity) {
  const tenantId = GetTenantId(activity);

  const serviceUrl = activity?.serviceUrl ?? null;

  const conversationId = activity?.conversation?.id ?? null;

  const conversationType = GetConversationType(activity);

  const teamAadGroupId = activity?.channelData?.team?.aadGroupId ?? null;

  const teamId = activity?.channelData?.team?.id ?? null;

  const channelId = activity?.channelData?.channel?.id ?? null;

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

  if (!defaultAssistant) {
    throw new Error("Organization does not have an assistant");
  }

  await assertAssistantMatchesOrganization(defaultAssistant, org.id);

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

  if (thread && Number(thread.assistant_id) !== Number(defaultAssistant.id)) {
    const error = new Error(
      "Group thread does not belong to the selected assistant",
    );

    error.status = 403;

    throw error;
  }

  if (thread && thread.scope && thread.scope !== "group") {
    const error = new Error(
      "Teams group conversation resolved to a non-group thread",
    );

    error.status = 409;

    throw error;
  }

  /*
   * Create or migrate the OpenAI Conversation.
   */
  const ensured = await ensureTeamsConversation({
    thread,

    userId: null,

    assistant: defaultAssistant,

    organizationId: org.id,

    channel,

    scope: "group",

    externalConversationId: conversationId,
  });

  thread = ensured.thread;

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

  console.log("[TEAMS group install] Conversation ready", {
    dbThreadId: thread.id,

    openAiConversationId: ensured.conversationId,

    teamsConversationId: conversationId,
  });

  await sendReply(
    activity,

    conversationType === "channel"
      ? "Installed in this channel. Mention me (@MyDigitalBot) to talk."
      : "Installed in this group chat. Mention me (@MyDigitalBot) to talk.",
  );
}

/* =========================================================
   ROUTES
   ========================================================= */

export async function POST(req) {
  try {
    let activity;

    try {
      activity = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid JSON body",
        },
        {
          status: 400,
        },
      );
    }

    if (!activity || typeof activity !== "object" || Array.isArray(activity)) {
      return NextResponse.json(
        {
          error: "Invalid Teams activity",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Validate that this really came from
     * Microsoft Teams before processing it.
     */
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

    if (activity.type === "installationUpdate" && activity.action === "add") {
      const conversationType = GetConversationType(activity);

      if (
        conversationType === "channel" ||
        conversationType === "groupChat" ||
        activity?.conversation?.isGroup === true
      ) {
        await handleGroupInstallation(activity);
      } else {
        await handleUserInstallation(activity);
      }
    }

    if (
      activity.type === "installationUpdate" &&
      activity.action === "remove"
    ) {
      console.log("[TEAMS] Installation removed", {
        conversationId: activity?.conversation?.id ?? null,

        tenantId: GetTenantId(activity),
      });
    }

    return NextResponse.json(
      {
        ok: true,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    return handleApiError(error, "Failed to process Teams message");
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
