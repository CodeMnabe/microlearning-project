// /lib/repos/pendingOutreach.repo.js
require("dotenv").config();
import { createClient as createServiceClient } from "@supabase/supabase-js";

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export async function createPendingOutreach({
  orgId,
  userId,
  payload,
  expiresAt, // Date or ISO string
  templateMessageId = null,
}) {
  const expiresISO =
    expiresAt instanceof Date
      ? expiresAt.toISOString()
      : new Date(expiresAt).toISOString();
  const { data, error } = await supabase
    .from("pending_outreach")
    .insert([
      {
        org_id: orgId,
        user_id: userId,
        payload, // jsonb
        status: "pending",
        expires_at: expiresISO, // <- toISOString() (was toIsoString)
        template_message_id: templateMessageId,
      },
    ])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getAllPendingOutreachByUser(userId) {
  const { data, error } = await supabase
    .from("pending_outreach")
    .select(
      "id, org_id, user_id, payload, status, expires_at, template_message_id, created_at"
    )
    .eq("user_id", userId)
    .eq("status", "pending") // <- make sure your insert uses 'pending'
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function markPendingOutreachReplied(id, replyMessageId) {
  const { data, error } = await supabase
    .from("pending_outreach") // <- was missing
    .update({
      status: "replied",
      reply_message_id: replyMessageId ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
