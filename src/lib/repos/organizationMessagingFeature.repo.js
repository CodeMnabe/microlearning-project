import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export async function getOrganizationMessagingFeature({
  organizationId,
  channel = "whatsapp",
}) {
  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  const { data, error } = await sb
    .from("organization_messaging_feature")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("channel", channel)
    .maybeSingle();

  if (error) throw error;

  return data ?? null;
}

export async function getOrCreateOrganizationMessagingFeature({
  organizationId,
  channel = "whatsapp",
}) {
  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  const existing = await getOrganizationMessagingFeature({
    organizationId,
    channel,
  });

  if (existing) return existing;

  const { data, error } = await sb
    .from("organization_messaging_feature")
    .insert({
      organization_id: organizationId,
      channel,
      read_chains_enabled: false,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function setReadChainsEnabled({
  organizationId,
  channel = "whatsapp",
  enabled,
}) {
  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  const { data, error } = await sb
    .from("organization_messaging_feature")
    .upsert(
      {
        organization_id: organizationId,
        channel,
        read_chains_enabled: Boolean(enabled),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "organization_id,channel",
      },
    )
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function isReadChainsEnabled({
  organizationId,
  channel = "whatsapp",
}) {
  const feature = await getOrganizationMessagingFeature({
    organizationId,
    channel,
  });

  return Boolean(feature?.read_chains_enabled);
}
