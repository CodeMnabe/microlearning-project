export const ASSISTANT_FILE_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  html: "text/html",
};

export const ASSISTANT_FILE_ACCEPT = Object.entries(ASSISTANT_FILE_TYPES)
  .flatMap(([extension, mime]) => [`.${extension}`, mime])
  .join(",");

export function resolveAssistantFileType(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (!file.name.includes(".") || !Object.hasOwn(ASSISTANT_FILE_TYPES, extension)) {
    return null;
  }
  return Object.values(ASSISTANT_FILE_TYPES).includes(file.type)
    ? file.type
    : ASSISTANT_FILE_TYPES[extension];
}
