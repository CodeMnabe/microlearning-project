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

export async function createUser({
  organizationId,
  phoneNumber,
  name,
  email = null,
  assistantId,
}) {
  const { data, error } = await supabase
    .from("user")
    .insert([
      {
        organization_id: organizationId,
        phone_number: cleanMsisdn(phoneNumber),
        name,
        email,
        assistant_id: assistantId,
      },
    ])
    .select()
    .single();
  if (error) throw error;
  // return in the same enriched shape as list
  return await getUserById(data.id);
}

export async function deleteUser(userId) {
  const { error } = await supabase.from("user").delete().eq("id", userId);
  if (error) throw error;
  return true;
}

/**
 * updates:
 *  - name?: string
 *  - phoneNumber?: string
 *  - assistantId?: number|null
 *  - tagIds?: number[]  (full replacement of the user’s tag set)
 */
export async function updateUser(userId, updates) {
  const patch = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.phoneNumber !== undefined)
    patch.phone_number = cleanMsisdn(updates.phoneNumber);
  if (updates.email !== undefined) patch.email = updates.email;
  if (updates.assistantId !== undefined)
    patch.assistant_id = updates.assistantId;

  if (Object.keys(patch).length) {
    const { error: upErr } = await supabase
      .from("user")
      .update(patch)
      .eq("id", userId);
    if (upErr) throw upErr;
  }

  // Replace tag set if provided
  if (Array.isArray(updates.tagIds)) {
    // current set
    const { data: existing, error: exErr } = await supabase
      .from("user_tag")
      .select("tag_id")
      .eq("user_id", userId);
    if (exErr) throw exErr;

    const have = new Set((existing || []).map((r) => r.tag_id));
    const want = new Set(updates.tagIds.map((n) => Number(n)));

    const toInsert = [...want].filter((id) => !have.has(id));
    const toDelete = [...have].filter((id) => !want.has(id));

    if (toInsert.length) {
      const rows = toInsert.map((tagId) => ({
        user_id: userId,
        tag_id: tagId,
      }));
      const { error: insErr } = await supabase.from("user_tag").insert(rows);
      if (insErr) throw insErr;
    }
    if (toDelete.length) {
      const { error: delErr } = await supabase
        .from("user_tag")
        .delete()
        .eq("user_id", userId)
        .in("tag_id", toDelete);
      if (delErr) throw delErr;
    }
  }

  // return fresh enriched row
  return await getUserById(userId);
}

export async function getUserById(userId) {
  // include tags via the join table
  const { data, error } = await supabase
    .from("user")
    .select(
      `
      id, organization_id, phone_number, name, assistant_id, created_at,
      user_tag:user_tag (
        tag:tags ( id, name, slug, color )
      )
    `
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const tags = (data.user_tag || []).map((ut) => ut.tag).filter(Boolean);

  return {
    id: data.id,
    organization_id: data.organization_id,
    phone_number: data.phone_number,
    name: data.name,
    assistant_id: data.assistant_id,
    created_at: data.created_at,
    // convenient shapes for the UI:
    tags, // [{id,name,slug,color}]
    tag_ids: tags.map((t) => t.id), // [number]
    tag_names: tags.map((t) => t.name), // [string]
  };
}

export async function getUserByNumber(phoneNumber) {
  const digits = cleanMsisdn(phoneNumber);

  // exact
  let { data, error } = await supabase
    .from("user")
    .select("id")
    .eq("phone_number", digits)
    .maybeSingle();
  if (error) throw error;
  if (data) return await getUserById(data.id);

  // trailing match
  const alt = await supabase
    .from("user")
    .select("id")
    .ilike("phone_number", `%${digits}`)
    .maybeSingle();

  return alt.data ? await getUserById(alt.data.id) : null;
}

export async function getUsersInOrg(orgId) {
  const { data, error } = await supabase
    .from("user")
    .select(
      `
      id, name, phone_number, email, assistant_id, created_at,
      user_tag:user_tag (
        tag:tags ( id, name, slug, color )
      )
    `
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data || []).map((u) => {
    const tags = (u.user_tag || []).map((ut) => ut.tag).filter(Boolean);
    return {
      id: u.id,
      name: u.name,
      phone_number: u.phone_number,
      email: u.email,
      assistant_id: u.assistant_id,
      created_at: u.created_at,
      tags, // objects
      tag_ids: tags.map((t) => t.id),
      tag_names: tags.map((t) => t.name),
    };
  });
}
