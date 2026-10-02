/*
 * Grupos do Teams (#165): chats de grupo e equipas onde o bot está
 * instalado, guardados em teams_installation com scope "group".
 */

const GROUP_COLUMNS =
  "id, organization_id, assistant_id, name, conversation_id, conversation_type, service_url, tenant_id, team_id, channel_id, is_active, created_at, last_seen_at";

const MESSAGE_LIMIT = 300;

export async function listOrgTeamsGroups(admin, orgId) {
  const { data, error } = await admin
    .from("teams_installation")
    .select(GROUP_COLUMNS)
    .eq("organization_id", orgId)
    .eq("scope", "group")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updateTeamsGroup(admin, groupId, patch) {
  const { data, error } = await admin
    .from("teams_installation")
    .update(patch)
    .eq("id", groupId)
    .eq("scope", "group")
    .select(GROUP_COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

export async function getOrgAssistantNames(admin, orgId) {
  const { data, error } = await admin
    .from("assistant")
    .select("id, name")
    .eq("organization_id", orgId);

  if (error) throw error;
  return data || [];
}

/*
 * Conversas de grupo do Teams destes assistentes. A conversa não guarda a
 * organização, por isso a ligação faz-se pelos assistentes dela.
 */
export async function getGroupThreadsForAssistants(admin, assistantIds) {
  if (!assistantIds.length) return [];

  const { data, error } = await admin
    .from("thread")
    .select(
      "id, assistant_id, external_conversation_id, created_at, last_message_at",
    )
    .eq("scope", "group")
    .eq("channel", "teams")
    .in("assistant_id", assistantIds);

  if (error) throw error;
  return data || [];
}

/* Últimas mensagens destas conversas, da mais antiga para a mais recente. */
export async function getMessagesForThreads(admin, threadIds) {
  if (!threadIds.length) return [];

  const { data, error } = await admin
    .from("message")
    .select(
      "id, thread_id, user_id, assistant_id, role, content, created_at, delivery_status",
    )
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_LIMIT);

  if (error) throw error;
  return (data || []).reverse();
}

/*
 * Data da última mensagem nestas conversas (as de um grupo). O
 * thread.last_message_at não é atualizado, por isso vai-se à mensagem.
 */
export async function getLastMessageDate(admin, threadIds) {
  if (!threadIds.length) return null;

  const { data, error } = await admin
    .from("message")
    .select("created_at")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.created_at ?? null;
}

export async function getOrgUsersForGroups(admin, orgId) {
  const { data, error } = await admin
    .from("user")
    .select("id, name, email, teams_aad_object_id")
    .eq("organization_id", orgId);

  if (error) throw error;
  return data || [];
}
