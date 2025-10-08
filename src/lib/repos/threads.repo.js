// /lib/repos/threads.repo.js
require("dotenv").config();
import { createClient as createServiceClient } from "@supabase/supabase-js";

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Table: thread
 * cols: id (int4), user_id (int4), assistant_id (int4),
 *       ai_thread_id (text UNIQUE), created_at (timestamp)
 */
const SELECT_COLS = "id, user_id, assistant_id, ai_thread_id, created_at";

export async function createThread({ userId, assistantId, aiThreadId }) {
  console.log("CREATING THREAD");
  if (!userId || !assistantId || !aiThreadId) {
    throw new Error("createThread requires userId, assistantId and aiThreadId");
  }
  const { data, error } = await supabase
    .from("thread")
    .insert([
      { user_id: userId, assistant_id: assistantId, ai_thread_id: aiThreadId },
    ])
    .select(SELECT_COLS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * getOrCreateThread:
 * - If a row with this ai_thread_id exists, return it.
 * - Otherwise create it with (userId, assistantId, aiThreadId).
 *   (Safer than upsert to avoid null-overwrites.)
 */
export async function getOrCreateThread({ userId, assistantId, aiThreadId }) {
  console.log("GETTING OR CREATING THREAD");
  if (!aiThreadId) throw new Error("getOrCreateThread requires aiThreadId");

  // 1) try to find existing by ai_thread_id
  const { data: existing, error: selErr } = await supabase
    .from("thread")
    .select(SELECT_COLS)
    .eq("ai_thread_id", aiThreadId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) {
    console.log(existing);
    return existing;
  }

  // 2) create new
  return await createThread({ userId, assistantId, aiThreadId });
}

export async function getThreadsForUser(userId) {
  const { data, error } = await supabase
    .from("thread")
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Keeping your originals for completeness/back-compat:
export async function ensureThreadByAiId({ userId, assistantId, aiThreadId }) {
  // Upsert in case callers still rely on it.
  const { data, error } = await supabase
    .from("thread")
    .upsert(
      [
        {
          user_id: userId ?? null,
          assistant_id: assistantId ?? null,
          ai_thread_id: aiThreadId,
        },
      ],
      { onConflict: "ai_thread_id" }
    )
    .select(SELECT_COLS)
    .single();
  if (error) throw error;
  return data;
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
