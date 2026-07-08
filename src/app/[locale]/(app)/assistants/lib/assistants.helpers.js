import { DEFAULT_CREATE_ASSISTANT_FORM } from "./assistants.constants";

/**
 * Helpers puros da camada Assistants.
 *
 * Responsabilidades:
 * - normalizar listas vindas da API;
 * - construir payloads para criação/edição;
 * - construir paths de upload;
 * - normalizar metadados de ficheiros;
 * - validar dados mínimos de formulários.
 *
 * Este ficheiro não deve:
 * - usar React;
 * - usar JSX;
 * - chamar Supabase;
 * - fazer fetch;
 * - mostrar alerts;
 * - alterar estado diretamente.
 */

/**
 * Garante que a resposta da API é sempre tratada como array.
 */
export function normalizeAssistantsList(data) {
  return Array.isArray(data) ? data : [];
}


/**
 * Devolve o ID do primeiro assistente da lista.
 *
 * A API devolve os assistentes ordenados por created_at desc,
 * por isso o primeiro tende a ser o mais recente.
 */
export function getFirstAssistantId(assistants) {
  return assistants[0]?.id ?? null;
}

/**
 * Constrói o payload usado para atualizar um assistente.
 *
 * Mantém apenas os campos que a API precisa de receber.
 */

export function buildAssistantUpdatePayload(selected, draft) {
  return {
    id: selected.id,
    open_ai_id: selected.open_ai_id,
    name: draft.name,
    description: draft.description,
    instructions: draft.instructions,
    model: draft.model,
    temperature: draft.temperature,
    top_p: draft.top_p,
  };
}

export function buildCreateAssistantPayload(orgId, form) {
  return {
    organizationId: orgId,
    name: form.name,
    description: form.description,
    instructions: form.instructions,
    model: form.model,
    top_p: form.top_p,
    temperature: form.temperature,
  };
}

export function updateCreateAssistantForm(form, field, value) {
  return {
    ...form,
    [field]: value,
  };
}

export function getEmptyCreateAssistantForm() {
  return { ...DEFAULT_CREATE_ASSISTANT_FORM };
}

export function buildAssistantStoragePath({
  orgId,
  assistantId,
  fileName,
  timestamp,
}) {
  return `${orgId}/${assistantId}/${timestamp}-${fileName}`;
}

export function buildUploadedFilePayload({ bucket, path, file }) {
  return {
    bucket,
    path,
    name: file.name,
    size: file.size,
    type: file.type,
  };
}

export function hasVectorStoreFormData(name, files) {
  return Boolean(name?.trim()) && Array.isArray(files) && files.length > 0;
}

export function readAssistantField({
  isEditing,
  draft,
  selected,
  key,
  fallback = "",
}) {
  return (isEditing ? draft?.[key] : selected?.[key]) ?? fallback;
}