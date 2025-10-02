// src/lib/repos/user.repo.js
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

const supabase = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // service role => bypasses RLS
  { auth: { persistSession: false } }
);

function cleanMsisdn(n) {
  return String(n).replace(/\D/g, "").slice(-9);
}

export async function createUser({ organizationId, phoneNumber, name }) {
  const { data, error } = await supabase
    .from("user")
    .insert([
      {
        organization_id: organizationId,
        phone_number: cleanMsisdn(phoneNumber),
        name,
      },
    ])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteUser(userId) {
  const { error } = await supabase.from("user").delete().eq("id", userId);
  if (error) throw error;
  return true;
}

export async function updateUser(userId, updates) {
  const patch = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.phoneNumber !== undefined)
    patch.phone_number = cleanMsisdn(updates.phoneNumber);

  const { data, error } = await supabase
    .from("user")
    .update(patch)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getUserById(userId) {
  const { data, error } = await supabase
    .from("user")
    .select("id, organization_id, phone_number, name, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getUserByNumber(phoneNumber) {
  const digits = cleanMsisdn(phoneNumber);

  // exact match first
  let { data, error } = await supabase
    .from("user")
    .select("id, organization_id, phone_number, name, created_at")
    .eq("phone_number", digits)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  // fallback: trailing match (if some rows stored cc or spaces)
  const alt = await supabase
    .from("user")
    .select("id, organization_id, phone_number, name, created_at")
    .ilike("phone_number", `%${digits}`)
    .maybeSingle();

  return alt.data ?? null;
}

export async function getUsersInOrg(orgId) {
  const { data, error } = await supabase
    .from("user")
    .select("id, name, phone_number, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
