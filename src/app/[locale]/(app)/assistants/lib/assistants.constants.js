export const ASSISTANT_UPLOADS_BUCKET = "assistant-uploads";

export const DEFAULT_ASSISTANT_MODEL = "gpt-4.1";

export const ASSISTANT_MODEL_OPTIONS = [
  { value: DEFAULT_ASSISTANT_MODEL, label: DEFAULT_ASSISTANT_MODEL },
];

export const DEFAULT_CREATE_ASSISTANT_FORM = {
  name: "",
  description: "",
  instructions: "",
  model: DEFAULT_ASSISTANT_MODEL,
  top_p: 0.5,
  temperature: 1.0,
};