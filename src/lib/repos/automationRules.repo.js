import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export async function createAutomationRule(row) {
  const { data, error } = await sb
    .from("automation_rule")
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAutomationRuleById(id) {
  const { data, error } = await sb
    .from("automation_rule")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getOrgAutomationRules(organizationId) {
  const { data, error } = await sb
    .from("automation_rule")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
}

export async function getActiveAutomationRules({
  organizationId = null,
  triggerType = null,
}) {
  let query = sb
    .from("automation_rule")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (organizationId != null) {
    query = query.eq("organization_id", organizationId);
  }

  if (triggerType) {
    query = query.eq("trigger_type", triggerType);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function updateAutomationRule(id, patch) {
  const { data, error } = await sb
    .from("automation_rule")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAutomationRule(id) {
  const { error } = await sb.from("automation_rule").delete().eq("id", id);
  if (error) throw error;
  return true;
}
