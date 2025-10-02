// /lib/repos/threads.repo.js
require("dotenv").config();
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Use the service-role key for all server-side writes (bypasses RLS)
const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Create a thread row in Supabase.
 * Relies on DB FKs to ensure user/assistant exist.
 */
export async function createThread({ userId, assistantId, aiThreadId }) {
  const { data, error } = await supabase
    .from("thread")
    .insert([
      {
        user_id: userId,
        assistant_id: assistantId,
        ai_thread_id: aiThreadId,
      },
    ])
    .select("id, user_id, assistant_id, ai_thread_id, created_at")
    .single();

  if (error) throw error;
  return data;
}

/** Fetch one thread by id (or null). */
export async function getThreadById(threadId) {
  const { data, error } = await supabase
    .from("thread")
    .select("id, user_id, assistant_id, ai_thread_id, created_at")
    .eq("id", threadId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getOrCreateThread({ userId, assistantId, aiThreadId }) {
  // Try to insert; if it conflicts, fetch the existing one
  const { data, error } = await supabase
    .from("thread")
    .insert([
      { user_id: userId, assistant_id: assistantId, ai_thread_id: aiThreadId },
    ])
    .select()
    .single();

  if (!error) return data;

  // If conflict, read the latest thread for this user (and assistant if you enforced that)
  if (error.code === "23505") {
    const { data: existing, error: readErr } = await supabase
      .from("thread")
      .select("id, user_id, assistant_id, ai_thread_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readErr) throw readErr;
    return existing;
  }

  throw error;
}

/** All threads for a user, oldest → newest (like your previous code expected). */
export async function getThreadsForUser(userId) {
  const { data, error } = await supabase
    .from("thread")
    .select("id, user_id, assistant_id, ai_thread_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}
