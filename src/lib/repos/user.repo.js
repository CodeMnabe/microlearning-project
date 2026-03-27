// src/lib/repos/user.repo.js
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

const supabase = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // service role => bypasses RLS
  { auth: { persistSession: false } },
);

function cleanMsisdn(n) {
  return String(n).replace(/\D/g, "");
}

export async function createUser({
  organizationId,
  phoneNumber, // full E.164, e.g. "+351912345678"
  phoneCountryCode, // e.g. "+351"
  phoneNational, // e.g. "912345678"
  name,
  email = null,
  assistantId,
  teamsAadObjectId,
  teamsFromId,
}) {
  const row = {
    organization_id: organizationId,
    name,
    email,
    assistant_id: assistantId ?? null,
  };

  // full E.164 as-is (no digit stripping)
  if (phoneNumber !== undefined) {
    row.phone_number = phoneNumber === null ? null : String(phoneNumber).trim();
  }

  // country code column
  if (phoneCountryCode !== undefined) {
    row.phone_country_code =
      phoneCountryCode === null ? null : String(phoneCountryCode).trim();
  }

  // national number (digits only)
  if (phoneNational !== undefined) {
    const digits = cleanMsisdn(phoneNational);
    row.phone_national = digits || null;
  }

  // ─── NEW: Teams fields ───
  if (teamsAadObjectId !== undefined) {
    row.teams_aad_object_id =
      teamsAadObjectId === null ? null : String(teamsAadObjectId).trim();
  }

  if (teamsFromId !== undefined) {
    row.teams_from_id =
      teamsFromId === null ? null : String(teamsFromId).trim();
  }
  // ─────────────────────────

  const { data, error } = await supabase
    .from("user")
    .insert([row])
    .select("id")
    .single();

  if (error) throw error;

  // return in the same enriched shape as list
  return await getUserById(data.id);
}

export async function deleteUser(userId) {
  // 1) remove join rows
  await supabase.from("user_tag").delete().eq("user_id", userId).throwOnError();

  // 2) delete messages linked to the user's threads (if you have them)
  const { data: threads } = await supabase
    .from("thread")
    .select("id")
    .eq("user_id", userId);

  const threadIds = (threads || []).map((t) => t.id);
  if (threadIds.length) {
    // if you have a message table referencing thread_id
    await supabase
      .from("message")
      .delete()
      .in("thread_id", threadIds)
      .throwOnError?.();
    // any other child tables that reference thread_id go here
    await supabase.from("thread").delete().in("id", threadIds).throwOnError?.();
  }

  // other tables that reference the user directly (optional)
  await supabase.from("pending_outreach").delete().eq("user_id", userId); // if exists

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
  if (updates.email !== undefined) patch.email = updates.email;
  if (updates.assistantId !== undefined)
    patch.assistant_id = updates.assistantId;

  // full E.164
  if (updates.phoneNumber !== undefined) {
    patch.phone_number =
      updates.phoneNumber === null ? null : String(updates.phoneNumber).trim();
  }

  // country code
  if (updates.phoneCountryCode !== undefined) {
    patch.phone_country_code =
      updates.phoneCountryCode === null
        ? null
        : String(updates.phoneCountryCode).trim();
  }

  // national (digits only)
  if (updates.phoneNational !== undefined) {
    const digits = cleanMsisdn(updates.phoneNational);
    patch.phone_national = digits || null;
  }

  if (updates.teamsAadObjectId !== undefined) {
    patch.teams_aad_object_id =
      updates.teamsAadObjectId === null
        ? null
        : String(updates.teamsAadObjectId).trim();
  }

  if (updates.teamsFromId !== undefined) {
    patch.teams_from_id =
      updates.teamsFromId === null ? null : String(updates.teamsFromId).trim();
  }

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
  const { data, error } = await supabase
    .from("user")
    .select(
      `
      id,
      organization_id,
      phone_number,
      phone_country_code,
      phone_national,
      name,
      email,
      assistant_id,
      created_at,
      user_tag:user_tag (
        tag:tags ( id, name, slug, color )
      )
    `,
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
    phone_country_code: data.phone_country_code,
    phone_national: data.phone_national,
    name: data.name,
    email: data.email,
    assistant_id: data.assistant_id,
    created_at: data.created_at,
    tags,
    tag_ids: tags.map((t) => t.id),
    tag_names: tags.map((t) => t.name),
  };
}

export async function getUserByNumber(phoneNumber) {
  const digits = cleanMsisdn(phoneNumber);

  // 1) primary: exact match on phone_national (new column)
  let { data, error } = await supabase
    .from("user")
    .select("id")
    .eq("phone_national", digits)
    .maybeSingle();

  if (error) throw error;
  if (data) return await getUserById(data.id);

  // 2) legacy: exact match on phone_number (old behaviour where we stored only national)
  const legacy = await supabase
    .from("user")
    .select("id")
    .eq("phone_number", digits)
    .maybeSingle();

  if (legacy.data) return await getUserById(legacy.data.id);

  // 3) trailing match on phone_number (handles cases where phone_number is full E.164)
  const alt = await supabase
    .from("user")
    .select("id")
    .ilike("phone_number", `%${digits}`)
    .maybeSingle();

  return alt.data ? await getUserById(alt.data.id) : null;
}

export async function getUserByEmail(email, tenant) {
  console.log("It got here");
  const _email = String(email || "")
    .trim()
    .toLowerCase();

  if (!_email || !tenant) return null;

  const { data, error } = await supabase
    .from("user")
    .select("id, organization:organization_id (id, teams_tenant_id)")
    .ilike("email", _email);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const matches = data.filter(
    (r) => r.organization?.teams_tenant_id === tenant,
  );

  if (matches.length === 0) return null;

  if (matches.length > 1) {
    const err = new Error("Multiple users match this email in this tenant");
    err.code = "AMBIGUOUS_EMAIL_TENANT";
    throw err;
  }

  console.log("User was found");

  return matches[0].id;
}

export async function getUsersInOrg(orgId, { page = 1, pageSize = 100 } = {}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("user")
    .select(
      `id,name,phone_number,phone_country_code,phone_national,email,assistant_id,teams_aad_object_id,teams_from_id,created_at,user_tag:user_tag (
        tag:tags ( id, name, slug, color )
      )`,
      { count: "exact" },
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  const items = (data || []).map((u) => {
    const tags = (u.user_tag || []).map((ut) => ut.tag).filter(Boolean);

    return {
      id: u.id,
      name: u.name,
      phone_number: u.phone_number,
      phone_country_code: u.phone_country_code,
      phone_national: u.phone_national,
      email: u.email,
      assistant_id: u.assistant_id,
      teams_aad_object_id: u.teams_aad_object_id,
      teams_from_id: u.teams_from_id,
      created_at: u.created_at,
      tags,
      tag_ids: tags.map((t) => t.id),
      tag_names: tags.map((t) => t.name),
    };
  });

  return {
    items,
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getUserByAadObjectId(aadObjectId) {
  if (!aadObjectId) return null;

  const { data, error } = await supabase
    .from("user")
    .select("*")
    .eq("teams_aad_object_id", aadObjectId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
