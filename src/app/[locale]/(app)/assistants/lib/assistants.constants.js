
/**
 * Constants da camada Assistants.
 *
 * Centraliza valores fixos usados pela feature:
 * - bucket de uploads;
 * - modelo padrão;
 * - opções de modelo;
 * - estado inicial do formulário de criação.
 */

/**
 * Bucket do Supabase Storage usado para ficheiros
 * associados às vector stores dos assistentes.
 */

export const ASSISTANT_UPLOADS_BUCKET = "assistant-uploads";

/**
 * Modelo padrão usado na criação de novos assistentes.
 */

export const DEFAULT_ASSISTANT_MODEL = "gpt-4.1";

export const ASSISTANT_MODEL_OPTIONS = [
  { value: DEFAULT_ASSISTANT_MODEL, label: DEFAULT_ASSISTANT_MODEL },
];

/**
 * Estado inicial do formulário de criação de assistente.
 */
export const DEFAULT_CREATE_ASSISTANT_FORM = {
  name: "",
  description: "",
  instructions: "",
  model: DEFAULT_ASSISTANT_MODEL,
  top_p: 0.5,
  temperature: 1.0,
};