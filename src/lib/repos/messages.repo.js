import { createClient as createServiceClient } from "@supabase/supabase-js";

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role bypasses RLS
);

/**
 * Create a message row.
 * role: "user" (inbound) | "assistant" (outbound) | "system"
 */
export async function createMessage({
  threadId,
  userId,
  messageId = null, // provider message id from Bird
  whatsAppId = null, // Bird contact id (or channel msg id if you prefer)
  content = "",
  role = "user",
}) {
  console.log(`Creating message for ${userId}`);
  const { data, error } = await supabase
    .from("message")
    .insert([
      {
        thread_id: threadId ?? null,
        user_id: userId ?? null,
        message_id: messageId,
        whatsapp_id: whatsAppId,
        content,
        role, // "user" | "assistant"
        // created_at handled by DB default NOW()
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

/** Last inbound (user) message for a user */
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

/** Is the WhatsApp 24h window open for this user? */
export async function isWindowOpenForUser(userId) {
  const last = await getLastInboundForUser(userId);
  if (!last) return false;
  const diffMs = Date.now() - new Date(last.created_at).getTime();
  return diffMs < 24 * 60 * 60 * 1000;
}
