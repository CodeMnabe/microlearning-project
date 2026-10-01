import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export async function upsertTeamsInstallation(row) {
  console.log("It reached here");
  const { data, error } = await sb
    .from("teams_installation")
    .upsert(row, { onConflict: "tenant_id,conversation_id" })
    .select()
    .single();

  console.log(data);

  if (error) throw error;
  return data;
}

export async function getTeamsInstallationByConversation({
  tenantId,
  conversationId,
}) {
  const { data, error } = await sb
    .from("teams_installation")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getTeamsUserInstallation({
  userId,
  organizationId,
  conversationType = "personal",
}) {
  if (!organizationId) return null;

  const { data, error } = await sb
    .from("teams_installation")
    .select("*")
    .eq("scope", "user")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("conversation_type", conversationType)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/*
 * Personal installations of people the bot could not match to a
 * platform user yet (#153). They get a user when the admin adds
 * someone with the same Microsoft email.
 */
export async function getPendingTeamsUserInstallations(
  organizationId,
  limit = 50,
) {
  if (!organizationId) return [];

  const { data, error } = await sb
    .from("teams_installation")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("scope", "user")
    .eq("conversation_type", "personal")
    .eq("is_active", true)
    .is("user_id", null)
    .order("last_seen_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
