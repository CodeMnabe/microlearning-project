// /lib/repos/organizations.repo.js
import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Table: organization
 * cols: id (int4), name (text), created_at (timestamp)  ← adjust if different
 */

export async function createOrganization(name) {
  const { data, error } = await sb
    .from("organization")
    .insert([{ name }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAllOrganization() {
  const { data, error } = await sb
    .from("organization")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getOrganization(orgId) {
  const { data, error } = await sb
    .from("organization")
    .select("*")
    .eq("id", orgId)
    .single();
  if (error) throw error;
  return data;
}

export async function getOrganizationByTeamsTenantId(tenantId) {
  const { data, error } = await sb
    .from("organization")
    .select("*")
    .eq("teams_tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
