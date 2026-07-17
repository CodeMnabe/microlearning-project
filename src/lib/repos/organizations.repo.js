// /lib/repos/organizations.repo.js

import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
    },
  },
);

export async function updateOrganizationProfile(orgId, updates = {}) {
  if (!orgId) {
    throw new Error("Organization id is required");
  }

  const patch = {};

  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.theme !== undefined) patch.theme = updates.theme;
  if (updates.logo_url !== undefined) patch.logo_url = updates.logo_url;
  if (updates.default_phone_country_code !== undefined) {
    patch.default_phone_country_code = updates.default_phone_country_code;
  }

  if (!Object.keys(patch).length) {
    throw new Error("At least one organization profile field is required");
  }

  const { data, error } = await sb
    .from("organization")
    .update(patch)
    .eq("id", orgId)
    .select("id, name, theme, logo_url, default_phone_country_code")
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
  if (!orgId) {
    throw new Error("orgId is required");
  }

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
