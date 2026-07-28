/**
 * Funções puras da subfeature Broadcast Templates.
 *
 * Mantém presets, normalização, validação e payloads fora do hook e da UI.
 */

export function getTemplatePreset(key) {
  switch (key) {
    case "image_header_quickreplies":
      return [
        {
          type: "HEADER",
          format: "IMAGE",
          example: { header_url: ["https://cdn.example.com/tip1.jpg"] },
        },
        {
          type: "BODY",
          text: "Olá {{1}}! 🎓 Dica de hoje: {{2}}",
          example: { body_text: [["João", "Verificar pressão dos pneus"]] },
        },
        { type: "FOOTER", text: "Responda para saber mais" },
        {
          type: "BUTTONS",
          buttons: [
            { type: "QUICK_REPLY", text: "Quiz rápido" },
            { type: "QUICK_REPLY", text: "Parar" },
          ],
        },
      ];
    case "quiz_url_button":
      return [
        {
          type: "BODY",
          text: "Pergunta: {{1}}",
          example: { body_text: [["Qual a autonomia em WLTP?"]] },
        },
        {
          type: "BUTTONS",
          buttons: [
            { type: "QUICK_REPLY", text: "A" },
            { type: "QUICK_REPLY", text: "B" },
            { type: "QUICK_REPLY", text: "C" },
            {
              type: "URL",
              text: "Abrir Quiz",
              url: "https://example.com/quiz/{{1}}",
              example: { button_url: ["session-12345"] },
            },
          ],
        },
      ];
    case "text_quickreplies":
    default:
      return [
        {
          type: "BODY",
          text: "Olá {{1}}! 🎓 Microlearning: {{2}}. Dica: {{3}}",
          example: {
            body_text: [["João", "Baterias", "Evite cargas 100% diárias"]],
          },
        },
        {
          type: "BUTTONS",
          buttons: [
            { type: "QUICK_REPLY", text: "Ver mais" },
            { type: "QUICK_REPLY", text: "Parar" },
          ],
        },
      ];
  }
}

export function formatTemplateComponents(components) {
  return JSON.stringify(components, null, 2);
}

export function createInitialTemplateForm() {
  const presetKey = "text_quickreplies";

  return {
    name: "",
    language: "pt",
    category: "MARKETING",
    presetKey,
    componentsText: formatTemplateComponents(getTemplatePreset(presetKey)),
  };
}

export async function readJsonResponse(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
}

export function parseTemplateComponents(componentsText) {
  const components = JSON.parse(componentsText);

  if (!Array.isArray(components)) {
    throw new TypeError("COMPONENTS_MUST_BE_ARRAY");
  }

  return components;
}

export function buildCreateTemplatePayload({ orgId, form, components }) {
  return {
    orgId,
    name: form.name,
    language: form.language,
    category: form.category,
    components,
  };
}

export function buildSendTemplateTestPayload({
  orgId,
  sendTo,
  sendTemplate,
  sendParams,
  sendUrlVar,
}) {
  const payload = {
    orgId,
    to: sendTo,
    templateName: sendTemplate.name,
    languageCode: sendTemplate.language || "pt",
    params: sendParams
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  };

  if (sendUrlVar) {
    payload.components = [
      {
        type: "button",
        sub_type: "url",
        parameters: [{ type: "text", text: sendUrlVar }],
      },
    ];
  }

  return payload;
}

export function normalizeTemplateStatusKey(status) {
  return String(status || "NEW")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

