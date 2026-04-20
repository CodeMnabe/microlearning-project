import { createClient as createServiceClient } from "@supabase/supabase-js";

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export async function createMessage({
  threadId,
  userId,
  organizationId = null,
  assistantId = null,
  channel = null,
  messageId = null,
  externalContactId = null,
  content = "",
  role = "user",
  deliveryStatus = null,
  deliveredAt = null,
  readAt = null,
  failedAt = null,
  scheduledBroadcastId = null,
  automationRunId = null,
}) {
  const { data, error } = await supabase
    .from("message")
    .insert([
      {
        thread_id: threadId ?? null,
        user_id: userId ?? null,
        organization_id: organizationId,
        assistant_id: assistantId,
        channel,
        message_id: messageId,
        contact_id: externalContactId,
        content,
        role,
        delivery_status: deliveryStatus,
        delivered_at: deliveredAt,
        read_at: readAt,
        failed_at: failedAt,
        scheduled_broadcast_id: scheduledBroadcastId,
        automation_run_id: automationRunId,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getMessagesInThread(threadId) {
  const { data, error } = await supabase
    .from("message")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getMessageById(id) {
  const { data, error } = await supabase
    .from("message")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getMessageByProviderId(messageId) {
  const { data, error } = await supabase
    .from("message")
    .select("*")
    .eq("message_id", messageId)
    .maybeSingle();

  if (error) throw error;

  return data ?? null;
}

export async function getLastInboundForUser(userId) {
  const { data, error } = await supabase
    .from("message")
    .select("id, created_at")
    .eq("user_id", userId)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getLastInboundForUserAssistant(
  userId,
  assistantId,
  channel = null,
) {
  let query = supabase
    .from("message")
    .select("id, created_at, assistant_id, channel")
    .eq("user_id", userId)
    .eq("role", "user")
    .eq("assistant_id", assistantId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (channel) {
    query = query.eq("channel", channel);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function markMessageDelivered(messageRowId, at = new Date()) {
  const { data, error } = await supabase
    .from("message")
    .update({
      delivery_status: "delivered",
      delivered_at: new Date(at).toISOString(),
    })
    .eq("id", messageRowId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markMessageRead(messageRowId, at = new Date()) {
  const iso = new Date(at).toISOString();

  const { data, error } = await supabase
    .from("message")
    .update({
      delivery_status: "read",
      deliveredAt: iso,
      read_at: iso,
    })
    .eq("id", messageRowId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markMessageFailed(messageRowId, at = newDate()) {
  const { data, error } = await supabase
    .from("message")
    .update({
      delivery_status: "failed",
      failed_at: new Date(at).toISOString(),
    })
    .eq("id", messageRowId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function isWindowOpenForUser(userId) {
  const last = await getLastInboundForUser(userId);
  if (!last) return false;
  const diffMs = Date.now() - new Date(last.created_at).getTime();
  return diffMs < 24 * 60 * 60 * 1000;
}
