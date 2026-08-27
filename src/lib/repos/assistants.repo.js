// /lib/repos/assistants.repo.js
import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
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
  name,
  description,
  instructions,
  model,
  top_p,
  temperature,
}) {
  const orgId = Number(organizationId);

  if (!Number.isInteger(orgId) || orgId <= 0) {
    throw new Error(
      `createAssistant received invalid organizationId: ${organizationId}`,
    );
  }

  const { data, error } = await sb
    .from("assistant")
    .insert([
      {
        organization_id: orgId,

        /*
         * New assistants have no OpenAI Assistant ID.
         */
        open_ai_id: null,

        name,
        description: description ?? null,
        instructions: instructions ?? null,
        model,
        top_p: top_p ?? null,
        temperature: temperature ?? null,
        vector_store_id: null,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function updateAssistant(assistantId, updates) {
  const patch = {};

  const allow = [
    "name",
    "description",
    "instructions",
    "model",
    "top_p",
    "temperature",
    "vector_store_id",
  ];

  for (const key of allow) {
    if (updates[key] !== undefined) {
      patch[key] = updates[key];
    }
  }

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
  const orgId = Number(organizationId);

  if (!Number.isInteger(orgId) || orgId <= 0) {
    throw new Error(
      `getAssistantsInOrg received invalid organizationId: ${organizationId}`,
    );
  }

  const { data, error } = await sb
    .from("assistant")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", {
      ascending: false,
    });

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

export async function getFirstAssistantInOrg(organizationId) {
  const { data, error } = await sb
    .from("assistant")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error) return null;
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
