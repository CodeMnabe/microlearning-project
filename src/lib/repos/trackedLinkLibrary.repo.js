import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

/*
 * Links já usados pela organização, um por nome e destino, do mais recente
 * para o mais antigo. Lê a vista tracked_link_library, que só a service role
 * pode ler; a query filtra pela organização (org_id).
 */
export async function getTrackedLinkLibraryByOrg(orgId, { limit = 200 } = {}) {
  const { data, error } = await supabaseAdmin
    .from("tracked_link_library")
    .select("link_key, link_label, destination_url, last_used_at")
    .eq("org_id", orgId)
    .order("last_used_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}
