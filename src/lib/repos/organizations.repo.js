// /lib/repos/organizations.repo.js
import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
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

export async function getOrganizationByChannelId(channelId) {
  if (!channelId) return null;

  const { data, error } = await sb
    .from("organization")
    .select("*")
    .eq("channel_id", channelId)
    .maybeSingle();

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

export async function getOrganizationBirdConfig(orgId) {
  if (!orgId) throw new Error("orgId is required");

  const { data, error } = await sb
    .from("organization")
    .select("id, name, channel_id, waba_id, waba_namespace")
    .eq("id", orgId)
    .single();

  if (error) throw error;

  if (!data) {
    throw new Error(`Organization not found: ${orgId}`);
  }

  if (!data.channel_id) {
    throw new Error(
      `Organization ${orgId} does not have a channel_id configured`,
    );
  }

  return {
    organizationId: data.id,
    organizationName: data.name,
    channelId: data.channel_id,
    wabaId: data.waba_id,
    wabaNamespace: data.waba_namespace,
  };
}
