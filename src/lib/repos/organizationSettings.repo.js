import { getSupabaseAdminClient } from "@/lib/db/admin";

export const ORGANIZATION_SETTINGS_COLUMNS = [
  "id",
  "name",
  "default_phone_country_code",
  "theme",
  "logo_url",
  "teams_tenant_id",
  "waba_id",
  "waba_namespace",
].join(", ");

export async function getOrganizationSettings(orgId) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("organization")
    .select(ORGANIZATION_SETTINGS_COLUMNS)
    .eq("id", orgId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateOrganizationSettings(orgId, patch) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("organization")
    .update(patch)
    .eq("id", orgId)
    .select(ORGANIZATION_SETTINGS_COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

export async function uploadOrganizationLogo({ path, bytes, contentType }) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.storage.from("images").upload(path, bytes, {
    contentType,
    upsert: false,
  });

  if (error) throw error;

  return path;
}

export async function removeOrganizationLogo(path) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.storage.from("images").remove([path]);

  if (error) throw error;
}

export async function updateOrganizationLogo(orgId, logoUrl) {
  return updateOrganizationSettings(orgId, { logo_url: logoUrl });
}
