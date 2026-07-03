import { createClient as createServiceClient } from "@supabase/supabase-js";


/**
 * Repositório de templates WhatsApp.
 *
 * Responsável por consultar templates disponíveis para uma organização
 * e obter detalhes necessários para envio via WhatsApp/Bird.
 *
 * Este repo não deve validar parâmetros de UI.
 * A validação de variáveis e preview pertence aos helpers/hooks/services.
 */

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
  let query = sb
    .from("whatsapp_templates")
    .select("*")
    .eq("status", "ACTIVE")
    .order("name", { ascending: true });

  if (orgId != null) {
    query = query.or(`org_id.eq.${Number(orgId)},org_id.is.null`);
  } else {
    query = query.is("org_id", null);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}
