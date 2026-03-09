import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export async function upsertTeamsInstallation(row) {
  const { data, error } = await sb
    .from("teams_installation")
    .upsert(row, { onConflict: "tenant_id,conversation_id" })
    .select()
    .single();

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
  conversationType = "personal",
}) {
  const { data, error } = await sb
    .from("teams_installation")
    .select("*")
    .eq("scope", "user")
    .eq("user_id", userId)
    .eq("conversation_type", conversationType)
    .maybeSingle();

  if (error) throw error;
  return data;
}
