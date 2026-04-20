import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export async function getWhatsappTemplateById(id) {
  const { data, error } = await sb
    .from("whatsapp_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getOrgWhatsappTemplates(orgId) {
  const { data, error } = await sb
    .from("whatsapp_templates")
    .select("*")
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}
