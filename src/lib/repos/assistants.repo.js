// /lib/repos/assistants.repo.js
import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // server-side writes
  { auth: { persistSession: false } }
);

/**
 * Table: assistant
 * cols: id (int4), organization_id (int4), open_ai_id (text), name (text),
 *       description (text), instructions (text), model (text),
 *       top_p (float8), temperature (float8), vector_store_id (int4, nullable),
 *       created_at (timestamp)
 */

export async function createAssistant({
  organizationId,
  openAiId,
  name,
  description,
  instructions,
  model,
  top_p,
  temperature,
}) {
  const { data, error } = await sb
    .from("assistant")
    .insert([
      {
        organization_id: organizationId,
        open_ai_id: openAiId,
        name,
        description,
        instructions,
        model,
        top_p,
        temperature,
        vector_store_id: null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAssistant(assistantId, updates) {
  // Only allow columns that exist in the table
  const patch = {};
  const allow = [
    "open_ai_id",
    "name",
    "description",
    "instructions",
    "model",
    "top_p",
    "temperature",
    "vector_store_id",
  ];
  for (const k of allow) if (updates[k] !== undefined) patch[k] = updates[k];

  const { data, error } = await sb
    .from("assistant")
    .update(patch)
    .eq("id", assistantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAssistantsInOrg(organizationId) {
  const { data, error } = await sb
    .from("assistant")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getAssistantById(id) {
  const { data, error } = await sb
    .from("assistant")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAssistant(id) {
  const { error } = await sb.from("assistant").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function associateVectorStoreToDbAssistant(assistantId, storeId) {
  const { error } = await sb
    .from("assistant")
    .update({ vector_store_id: storeId })
    .eq("id", assistantId);
  if (error) throw error;
  return true;
}

export async function nullifyVectorStoreToDbAssistant(assistantId) {
  const { error } = await sb
    .from("assistant")
    .update({ vector_store_id: null })
    .eq("id", assistantId);
  if (error) throw error;
  return true;
}
