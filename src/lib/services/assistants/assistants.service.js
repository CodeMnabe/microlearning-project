/**
 * Service principal da camada Assistants.
 *
 * Gere:
 * - listagem de assistentes por organização;
 * - criação de assistentes;
 * - carregamento de detalhes de um assistente;
 * - atualização de assistentes;
 * - remoção de assistentes;
 * - coordenação entre OpenAI e Supabase.
 *
 * Este service representa as regras de negócio principais da feature Assistants.
 *
 * Deve:
 * - chamar repos para operações de base de dados;
 * - chamar services OpenAI para operações externas;
 * - normalizar dados antes de os devolver às routes.
 *
 * Não deve:
 * - renderizar JSX;
 * - usar hooks React;
 * - gerir estado de frontend;
 * - mostrar alerts;
 * - devolver NextResponse diretamente;
 * - conter lógica visual.
 */

import {
  createAssistant,
  getAssistantsInOrg,
  getAssistantById,
  updateAssistant,
  deleteAssistant,
} from "@/lib/repos/assistants";

import {
  createOAiAssistant,
  updateOAiAssistant,
  deleteOAiAssistant,
} from "@/lib/services/openai";

export async function listAssistantsService(orgId) {
  if (!orgId) {
    return [];
  }

  return getAssistantsInOrg(orgId);
}

export async function createAssistantService(body) {
  const aiAssistant = await createOAiAssistant(body);

  if (!aiAssistant?.id) {
    throw new Error("Error creating assistant");
  }

  return createAssistant({
    organizationId: body.organizationId,
    openAiId: aiAssistant.id,
    name: body.name,
    description: body.description,
    instructions: body.instructions,
    model: body.model,
    top_p: body.top_p,
    temperature: body.temperature,
  });
}

export async function getAssistantDetailsService(assistantId) {
  const row = await getAssistantById(assistantId);

  if (!row) {
    return null;
  }

  return {
    ...row,
    vectorStoreId: row.vector_store_id ?? null,
  };
}

export async function updateAssistantService(assistantId, updates) {
  try {
    await updateOAiAssistant(updates);
  } catch (error) {
    console.error("[Assistants] OpenAI update failed:", error);
  }

  const updated = await updateAssistant(assistantId, updates);

  return {
    ...updated,
    vectorStoreId: updated.vector_store_id ?? null,
  };
}

export async function deleteAssistantService(assistantId) {
  const row = await getAssistantById(assistantId);

  if (!row) {
    return false;
  }

  try {
    await deleteOAiAssistant(row.open_ai_id);
  } catch (error) {
    console.error("[Assistants] OpenAI delete failed:", error);
  }

  await deleteAssistant(row.id);

  return true;
}