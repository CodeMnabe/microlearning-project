import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Table: user_teams_conversation
 * cols:
 *  - id (bigserial)
 *  - user_id (int4, FK user.id)
 *  - teams_user_id (text)
 *  - conversation_id (text)
 *  - service_url (text)
 *  - tenant_id (text)
 *  - conversation_type (text)
 *  - last_seen_at (timestamptz)
 *
 * UNIQUE (user_id, conversation_type)
 */

export async function upsertUserTeamsConversation({
  userId,
  teamsUserId,
  conversationId,
  serviceUrl,
  tenantId,
  conversationType = "personal",
}) {
  if (!userId || !teamsUserId || !conversationId || !serviceUrl || !tenantId) {
    throw new Error("Missing required fields for upsertUserTeamsConversations");
  }

  const row = {
    user_id: userId,
    teams_user_id: teamsUserId,
    conversation_id: conversationId,
    service_url: serviceUrl,
    tenant_id: tenantId,
    conversation_type: conversationType,
    last_seen_at: new Date().toISOString(),
  };

  const { data, error } = await sb
    .from("user_teams_conversation")
    .upsert(row, { onConflict: "user_id, conversation_type" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserTeamsConversation(
  userId,
  conversationType = "personal"
) {
  const { data, error } = await sb
    .from("user_teams_conversation")
    .select("*")
    .eq("user_id", userId)
    .eq("conversation_type", conversationType)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function deleteUserTeamsConversation(
  userId,
  conversation_type = "personal"
) {
  const { error } = await sb
    .from("user_teams_conversation")
    .delete()
    .eq("user_id", userId)
    .eq("conversation_type", conversation_type);

  if (error) throw error;
  return true;
}
