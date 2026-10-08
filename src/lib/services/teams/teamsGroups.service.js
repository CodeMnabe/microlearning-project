import {
  getGroupThreadsForAssistants,
  getLastMessageDate,
  getMessagesForThreads,
  getOrgAssistantNames,
  getOrgUsersForGroups,
  listOrgTeamsGroups,
  updateTeamsGroup,
} from "@/lib/repos/teamsGroups.repo";
import {
  listTeamsConversationMembers,
  memberEmails,
} from "@/lib/teams/members";
import { assertAssistantBelongsToOrg, throwHttpError } from "@/lib/auth/guards";

export const MAX_GROUP_NAME_LENGTH = 120;

/*
 * Mensagens de um grupo: a conversa do próprio grupo e, num canal, cada
 * publicação ("<canal>;messageid=<id>"), que tem a sua conversa (#165).
 */
export function belongsToGroupConversation(
  externalConversationId,
  groupConversationId,
) {
  const external = String(externalConversationId || "");
  const group = String(groupConversationId || "");

  return (
    Boolean(group) && (external === group || external.startsWith(`${group};`))
  );
}

function groupDto(group, assistantNames) {
  return {
    id: group.id,
    name: group.name || null,
    conversationType: group.conversation_type,
    assistantId: group.assistant_id,
    assistantName: assistantNames.get(group.assistant_id) || null,
    isActive: group.is_active !== false,
    createdAt: group.created_at,
  };
}

async function loadGroupContext(admin, orgId) {
  const assistants = await getOrgAssistantNames(admin, orgId);
  const assistantNames = new Map(assistants.map((a) => [a.id, a.name]));
  const threads = await getGroupThreadsForAssistants(
    admin,
    assistants.map((a) => a.id),
  );

  return { assistantNames, threads };
}

function threadIdsForGroup(threads, group) {
  return threads
    .filter((t) =>
      belongsToGroupConversation(
        t.external_conversation_id,
        group.conversation_id,
      ),
    )
    .map((t) => t.id);
}

export async function listTeamsGroups(admin, orgId) {
  const [groups, { assistantNames, threads }] = await Promise.all([
    listOrgTeamsGroups(admin, orgId),
    loadGroupContext(admin, orgId),
  ]);

  return Promise.all(
    groups.map(async (group) => ({
      ...groupDto(group, assistantNames),
      lastMessageAt: await getLastMessageDate(
        admin,
        threadIdsForGroup(threads, group),
      ),
    })),
  );
}

/* O grupo com as últimas mensagens trocadas, de quem escreveu e de quem respondeu. */
export async function getTeamsGroupDetail(admin, orgId, group) {
  const [{ assistantNames, threads }, users] = await Promise.all([
    loadGroupContext(admin, orgId),
    getOrgUsersForGroups(admin, orgId),
  ]);

  const userNames = new Map(users.map((u) => [u.id, u.name || u.email]));
  const messages = await getMessagesForThreads(
    admin,
    threadIdsForGroup(threads, group),
  );

  return {
    group: groupDto(group, assistantNames),
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
      /* Sem assistente é uma mensagem enviada pela plataforma (#166). */
      author:
        m.role === "user"
          ? { kind: "user", name: userNames.get(m.user_id) || null }
          : m.assistant_id
            ? {
                kind: "assistant",
                name: assistantNames.get(m.assistant_id) || null,
              }
            : { kind: "platform", name: null },
    })),
  };
}

/* Membros lidos no Teams, com a indicação de quem já é colaborador. */
export async function getTeamsGroupMembers(admin, orgId, group) {
  const [members, users] = await Promise.all([
    listTeamsConversationMembers({
      serviceUrl: group.service_url,
      conversationId: group.conversation_id,
    }),
    getOrgUsersForGroups(admin, orgId),
  ]);

  const byAad = new Map(
    users
      .filter((u) => u.teams_aad_object_id)
      .map((u) => [u.teams_aad_object_id, u]),
  );
  const byEmail = new Map(
    users.filter((u) => u.email).map((u) => [String(u.email).toLowerCase(), u]),
  );

  return members.map((member) => {
    const user =
      byAad.get(member.aadObjectId) ||
      memberEmails(member)
        .map((email) => byEmail.get(email))
        .find(Boolean) ||
      null;

    return {
      id: member.aadObjectId || member.id,
      name: member.name || user?.name || null,
      email: member.email || member.userPrincipalName || null,
      userId: user?.id ?? null,
    };
  });
}

/* Nome e assistente do grupo. Devolve os campos alterados para o histórico. */
export async function updateTeamsGroupSettings(
  admin,
  orgId,
  group,
  input = {},
) {
  const patch = {};

  if (input.name !== undefined) {
    const name = String(input.name ?? "").trim();

    if (name.length > MAX_GROUP_NAME_LENGTH) {
      throwHttpError(
        `Group name must not exceed ${MAX_GROUP_NAME_LENGTH} characters.`,
        400,
      );
    }

    patch.name = name || null;
  }

  if (input.assistantId !== undefined) {
    const assistantId = await assertAssistantBelongsToOrg(
      admin,
      orgId,
      input.assistantId,
    );

    if (!assistantId) throwHttpError("Assistant is required", 400);

    patch.assistant_id = assistantId;
  }

  if (!Object.keys(patch).length) throwHttpError("Nothing to update", 400);

  const updated = await updateTeamsGroup(admin, group.id, patch);

  return {
    updated,
    fields: [
      ...(patch.name !== undefined ? ["name"] : []),
      ...(patch.assistant_id !== undefined ? ["assistantId"] : []),
    ],
  };
}
