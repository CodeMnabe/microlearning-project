import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export async function createTrackedLink(row) {
  const { data, error } = await supabaseAdmin
    .from("tracked_link")
    .insert(row)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getTrackedLinkByToken(token) {
  const { data, error } = await supabaseAdmin
    .from("tracked_link")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function createTrackedLinkEvent(row) {
  const { data, error } = await supabaseAdmin
    .from("tracked_link_event")
    .insert(row)
    .select()
    .single();

  if (error) throw error;

  return data;
}
