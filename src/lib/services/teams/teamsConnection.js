import {
  getPendingTeamsUserInstallations,
  getTeamsInstallationByConversation,
  upsertTeamsInstallation,
} from "@/lib/repos/teamsInstallations.repo";
import {
  getUserByAadObjectId,
  getUserByEmail,
  getUserById,
  updateUser,
} from "@/lib/repos/user.repo";
import { getFirstAssistantInOrg } from "@/lib/repos/assistants.repo";
import { emitAutomationEvent } from "@/lib/services/automations/automationEngine";
import { getTeamsMember, memberEmails } from "@/lib/teams/members";

/*
 * Ligação entre uma conta do Teams e um utilizador da plataforma (#153).
 *
 * O bot só escreve a quem tem a app instalada, e só sabe quem é a pessoa
 * pelo email que a Microsoft devolve. A ligação faz-se em qualquer ordem:
 * - a pessoa já está na plataforma quando instala a app ou escreve ao bot:
 *   liga-se logo (linkTeamsUserByEmail);
 * - ainda não está: a instalação fica guardada sem utilizador e liga-se
 *   quando o administrador a adicionar com o mesmo email
 *   (linkPendingTeamsInstallations).
 */

const defaultDeps = {
  emitAutomationEvent,
  getFirstAssistantInOrg,
  getPendingTeamsUserInstallations,
  getTeamsInstallationByConversation,
  getTeamsMember,
  getUserByAadObjectId,
  getUserByEmail,
  getUserById,
  updateUser,
  upsertTeamsInstallation,
};

/*
 * O bot só consegue escrever depois de existir uma instalação pessoal,
 * por isso as regras "utilizador criado" do Teams contam a partir daqui.
 * A chave do run é por utilizador: voltar a ligar não repete as boas-vindas.
 */
export async function upsertPersonalInstallation(row, deps) {
  const d = { ...defaultDeps, ...deps };
  const installation = await d.upsertTeamsInstallation(row);

  try {
    await d.emitAutomationEvent({
      type: "user.created",
      organizationId: row.organization_id,
      userId: row.user_id,
      baseTime: new Date(),
      payload: { source: "teams.connected" },
      channels: ["teams"],
    });
  } catch (error) {
    console.error("[TEAMS] Failed to emit user.created", {
      userId: row.user_id,
      error: error?.message || String(error),
    });
  }

  return installation;
}

async function connectUser({ user, organizationId, aadObjectId, installation, d }) {
  await d.updateUser(user.id, {
    teamsAadObjectId: aadObjectId,
    teamsFromId: installation.teams_user_id,
  });

  const assistantId =
    user.assistant_id ??
    installation.assistant_id ??
    (await d.getFirstAssistantInOrg(organizationId))?.id;

  await upsertPersonalInstallation(
    {
      organization_id: organizationId,
      assistant_id: assistantId,
      scope: "user",
      user_id: user.id,
      tenant_id: installation.tenant_id,
      service_url: installation.service_url,
      conversation_id: installation.conversation_id,
      conversation_type: installation.conversation_type,
      teams_user_id: installation.teams_user_id,
      last_seen_at: new Date().toISOString(),
    },
    d,
  );

  return d.getUserById(user.id);
}

/**
 * Liga quem instalou a app ou escreveu ao bot ao utilizador da plataforma
 * com o mesmo email Microsoft. Devolve `{ linked, user, reason }`.
 */
export async function linkTeamsUserByEmail({
  organization,
  tenantId,
  aadObjectId,
  teamsUserId,
  serviceUrl,
  conversationId,
  conversationType,
  deps,
}) {
  const d = { ...defaultDeps, ...deps };

  const member = await d.getTeamsMember({
    serviceUrl,
    conversationId,
    memberId: teamsUserId,
  });

  /* A Microsoft tem de confirmar que é a mesma pessoa que fala com o bot. */
  if (!member || (member.aadObjectId && member.aadObjectId !== aadObjectId)) {
    return { linked: false, reason: "member_unavailable" };
  }

  let userId = null;

  for (const email of memberEmails(member)) {
    try {
      const ref = await d.getUserByEmail(email, tenantId);
      userId = typeof ref === "object" ? ref?.id : ref;
    } catch (error) {
      if (error.code === "AMBIGUOUS_EMAIL_TENANT") {
        return { linked: false, reason: "ambiguous" };
      }
      throw error;
    }

    if (userId) break;
  }

  if (!userId) return { linked: false, reason: "not_found" };

  const user = await d.getUserById(userId);

  if (!user || Number(user.organization_id) !== Number(organization.id)) {
    return { linked: false, reason: "not_found" };
  }

  /* Já ligado a outra conta do Teams: decide o administrador. */
  if (user.teams_aad_object_id && user.teams_aad_object_id !== aadObjectId) {
    return { linked: false, reason: "linked_elsewhere" };
  }

  const linkedUser = await connectUser({
    user,
    organizationId: organization.id,
    aadObjectId,
    installation: {
      assistant_id: null,
      tenant_id: tenantId,
      service_url: serviceUrl,
      conversation_id: conversationId,
      conversation_type: conversationType,
      teams_user_id: teamsUserId,
    },
    d,
  });

  return { linked: true, user: linkedUser };
}

/**
 * Guarda a instalação de quem ainda não está na plataforma, para a ligar
 * quando o administrador o adicionar. Uma instalação já ligada não é
 * tocada.
 */
export async function savePendingTeamsInstallation({
  organization,
  tenantId,
  teamsUserId,
  serviceUrl,
  conversationId,
  conversationType,
  deps,
}) {
  const d = { ...defaultDeps, ...deps };

  if (conversationType !== "personal") return null;

  const existing = await d.getTeamsInstallationByConversation({
    tenantId,
    conversationId,
  });

  if (existing?.user_id) return null;

  /* A coluna exige um assistente; passa a ser o do colaborador ao ligar. */
  const assistant = await d.getFirstAssistantInOrg(organization.id);

  if (!assistant) return null;

  return d.upsertTeamsInstallation({
    organization_id: organization.id,
    assistant_id: assistant.id,
    scope: "user",
    user_id: null,
    tenant_id: tenantId,
    service_url: serviceUrl,
    conversation_id: conversationId,
    conversation_type: conversationType,
    teams_user_id: teamsUserId,
    last_seen_at: new Date().toISOString(),
  });
}

/*
 * Numa importação de Excel a função corre uma vez por utilizador. A
 * resposta da Microsoft para cada instalação por associar fica guardada
 * uns minutos, para não a pedir de novo a cada linha.
 */
const PENDING_MEMBER_TTL_MS = 5 * 60 * 1000;
const pendingMemberCache = new Map();

async function getPendingMember(installation, d) {
  const key = `${installation.tenant_id}:${installation.conversation_id}`;
  const cached = pendingMemberCache.get(key);

  if (cached && Date.now() - cached.at < PENDING_MEMBER_TTL_MS) {
    return cached.member;
  }

  const member = await d.getTeamsMember({
    serviceUrl: installation.service_url,
    conversationId: installation.conversation_id,
    memberId: installation.teams_user_id,
  });

  pendingMemberCache.set(key, { member, at: Date.now() });

  return member;
}

/**
 * Chamado quando o administrador adiciona um utilizador: se alguém com o
 * mesmo email Microsoft já tinha instalado a app, fica ligado logo.
 */
export async function linkPendingTeamsInstallations({ user, deps }) {
  const d = { ...defaultDeps, ...deps };

  const email = String(user?.email || "").trim().toLowerCase();

  if (!email || !user?.organization_id) return null;

  const pending = await d.getPendingTeamsUserInstallations(
    user.organization_id,
  );

  for (const installation of pending) {
    const member = await getPendingMember(installation, d);

    if (!member?.aadObjectId || !memberEmails(member).includes(email)) {
      continue;
    }

    /* Esta conta do Teams já pertence a outro utilizador. */
    const owner = await d.getUserByAadObjectId(member.aadObjectId);

    if (owner && Number(owner.id) !== Number(user.id)) continue;

    return connectUser({
      user,
      organizationId: user.organization_id,
      aadObjectId: member.aadObjectId,
      installation,
      d,
    });
  }

  return null;
}
