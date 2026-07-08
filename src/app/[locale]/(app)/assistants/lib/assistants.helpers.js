import { DEFAULT_CREATE_ASSISTANT_FORM } from "./assistants.constants";

export function normalizeAssistantsList(data) {
  return Array.isArray(data) ? data : [];
}

export function getFirstAssistantId(assistants) {
  return assistants[0]?.id ?? null;
}

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