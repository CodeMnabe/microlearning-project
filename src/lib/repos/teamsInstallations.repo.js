import { createClient as createServiceClient } from "@supabase/supabase-js";
import { logger } from "@/lib/observability/logger";

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

  if (error) {
    logger.error(
      "teams_installation_persistence_failed",
      {
        provider: "supabase",
        operation: "teams_installation_upsert",
        outcome: "failed",
        organizationId: row?.organization_id,
        assistantId: row?.assistant_id,
        userId: row?.user_id,
      },
      error,
    );
    throw error;
  }
  logger.info("teams_installation_persisted", {
    provider: "supabase",
    operation: "teams_installation_upsert",
    outcome: "succeeded",
    organizationId: data?.organization_id,
    assistantId: data?.assistant_id,
    userId: data?.user_id,
  });
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
