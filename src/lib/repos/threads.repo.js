// /lib/repos/threads.repo.js
//require("dotenv").config();
import { createClient as createServiceClient } from "@supabase/supabase-js";

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const SELECT_COLS = `
  id,
  user_id,
  assistant_id,
  ai_thread_id,
  channel,
  scope,
  external_conversation_id,
  created_at,
  last_message_at,
  is_active
`;

function nowIso() {
  return new Date().toISOString();
}

/**
 * Create a new thread row.
 */
export async function createThread({
  userId,
  assistantId,
  aiThreadId,
  channel,
  scope,
  externalConversationId = null,
}) {
  if (!assistantId || !aiThreadId || !channel || !scope) {
    throw new Error(
      "createThread requires assistantId, aiThreadId, channel and scope"
    );
  }

  const payload = {
    user_id: userId ?? null,
    assistant_id: assistantId,
    ai_thread_id: aiThreadId,
    channel,
    scope,
    external_conversation_id: externalConversationId,
    last_message_at: nowIso(),
  };

  const { data, error } = await supabase
    .from("thread")
    .insert([payload])
    .select(SELECT_COLS)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update last_message_at whenever we get/send a message.
 */
export async function touchThread(threadId) {
  const { data, error } = await supabase
    .from("thread")
    .update({ last_message_at: nowIso() })
    .eq("id", threadId)
    .select(SELECT_COLS)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Personal (DM) thread for a user on a given channel.
 */
export async function getUserThreadForChannel({
  userId,
  assistantId,
  channel,
}) {
  const { data, error } = await supabase
    .from("thread")
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .eq("assistant_id", assistantId)
    .eq("channel", channel)
    .eq("scope", "user")
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/**
 * Group/channel thread identified by external_conversation_id (Teams).
 */
export async function getGroupThreadForConversation({
  assistantId,
  channel,
  externalConversationId,
}) {
  const { data, error } = await supabase
    .from("thread")
    .select(SELECT_COLS)
    .eq("assistant_id", assistantId)
    .eq("channel", channel)
    .eq("scope", "group")
    .eq("external_conversation_id", externalConversationId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/* ---------- Legacy helpers you already had ---------- */

export async function getThreadsForUser(userId) {
  const { data, error } = await supabase
    .from("thread")
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getThreadById(threadId) {
  const { data, error } = await supabase
    .from("thread")
    .select(SELECT_COLS)
    .eq("id", threadId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getThreadByAiId(aiThreadId) {
  const { data, error } = await supabase
    .from("thread")
    .select(SELECT_COLS)
    .eq("ai_thread_id", aiThreadId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Backwards-compatible: find by ai_thread_id, else create.
 * (Used if anything else in the code still calls getOrCreateThread.)
 */
export async function getOrCreateThread({
  userId,
  assistantId,
  aiThreadId,
  channel = "whatsapp",
  scope = "user",
  externalConversationId = null,
}) {
  if (!aiThreadId) throw new Error("getOrCreateThread requires aiThreadId");
  const existing = await getThreadByAiId(aiThreadId);
  if (existing) return existing;

  return createThread({
    userId,
    assistantId,
    aiThreadId,
    channel,
    scope,
    externalConversationId,
  });
}
