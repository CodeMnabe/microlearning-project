import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/db/admin";

const supabase = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function createContact({
  name,
  email,
  company = null,
  message,
  status = "new",
  source = "landing_page",
}) {
  const row = {
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    company: cleanText(company),
    message: String(message).trim(),
    status,
    source,
  };

  const { data, error } = await supabase
    .from("contact")
    .insert([row])
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function createDeduplicatedContact({
  name,
  email,
  company = null,
  message,
  fingerprint,
  windowSeconds,
}) {
  const { data, error } = await getSupabaseAdminClient().rpc(
    "create_deduplicated_contact",
    {
      p_name: name,
      p_email: email,
      p_company: company,
      p_message: message,
      p_fingerprint: fingerprint,
      p_window_seconds: windowSeconds,
    },
  );
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.accepted !== "boolean") {
    throw new Error("Contact creation response is invalid");
  }
  return { accepted: row.accepted, contactId: row.contact_id ?? null };
}

export async function getContactById(contactId) {
  const { data, error } = await supabase
    .from("contact")
    .select("*")
    .eq("id", contactId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getContacts({ status, limit = 100 } = {}) {
  let query = supabase
    .from("contact")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function updateContact(contactId, updates) {
  const patch = {};

  if (updates.name !== undefined) patch.name = String(updates.name).trim();
  if (updates.email !== undefined)
    patch.email = String(updates.email).trim().toLowerCase();
  if (updates.company !== undefined) patch.company = cleanText(updates.company);
  if (updates.message !== undefined)
    patch.message = String(updates.message).trim();
  if (updates.status !== undefined)
    patch.status = String(updates.status).trim();
  if (updates.source !== undefined)
    patch.source = String(updates.source).trim();

  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("contact")
    .update(patch)
    .eq("id", contactId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteContact(contactId) {
  const { error } = await supabase.from("contact").delete().eq("id", contactId);

  if (error) throw error;
  return true;
}
