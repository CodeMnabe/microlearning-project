import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export async function createScheduledBroadcast(row) {
  const { data, error } = await sb
    .from("scheduled_broadcast")
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getOrgScheduledBroadcasts(
  organizationId,
  { source = "all" } = {},
) {
  let query = sb
    .from("scheduled_broadcast")
    .select("*")
    .eq("organization_id", organizationId)
    .order("scheduled_for", { ascending: true });

  if (source === "manual") {
    query = query.not("created_by_user_id", "is", null);
  } else if (source === "automation") {
    query = query.is("created_by_user_id", null);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function updateScheduledBroadcast(id, patch) {
  const { data, error } = await sb
    .from("scheduled_broadcast")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deleteScheduledBroadcast(id) {
  const { error } = await sb.from("scheduled_broadcast").delete().eq("id", id);

  if (error) throw error;
  return true;
}

export async function getDueScheduledBroadcasts(limit = 20) {
  const nowIso = new Date().toISOString();

  const { data, error } = await sb
    .from("scheduled_broadcast")
    .select("*")
    .eq("status", "queued")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function markScheduledBroadcastProcessing(id) {
  const { data, error } = await sb
    .from("scheduled_broadcast")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "queued")
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function finishScheduledBroadcast(id, patch) {
  const { data, error } = await sb
    .from("scheduled_broadcast")
    .update({
      ...patch,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
