// Pure helpers that turn the visual template form into the components array
// expected by the provider (Meta-style HEADER / BODY / FOOTER / BUTTONS).
// No React here so it can be unit-tested directly.

export const LIMITS = {
  nameMax: 512,
  headerTextMax: 60,
  bodyMax: 1024,
  footerMax: 60,
  buttonTextMax: 25,
  buttonUrlMax: 2000,
  buttonsMax: 10,
  urlButtonsMax: 2,
};

export const HEADER_TYPES = ["none", "text", "image"];
export const BUTTON_TYPES = ["QUICK_REPLY", "URL"];

const VARIABLE_RE = /\{\{\s*(\d+)\s*\}\}/g;

let buttonSeq = 0;
function nextButtonId() {
  buttonSeq += 1;
  return `btn_${buttonSeq}`;
}

export function makeButton(type, overrides = {}) {
  return {
    id: nextButtonId(),
    type,
    text: "",
    url: "",
    urlExample: "",
    ...overrides,
  };
}

export function emptyTemplateForm() {
  return {
    header: { type: "none", text: "", textExample: "", imageUrl: "" },
    body: { text: "", examples: [] },
    footer: "",
    buttons: [],
  };
}

/** Returns the variable numbers found in `text`, in order of appearance. */
export function extractVariables(text) {
  const out = [];
  for (const m of String(text || "").matchAll(VARIABLE_RE)) {
    out.push(Number(m[1]));
  }
  return out;
}

/** Highest variable number in `text` (0 when there are none). */
export function variableCount(text) {
  return extractVariables(text).reduce((max, n) => Math.max(max, n), 0);
}

/** True when the variables are exactly {{1}}..{{n}} with no gaps. */
export function variablesAreSequential(text) {
  const nums = extractVariables(text);
  if (nums.length === 0) return true;
  const unique = [...new Set(nums)].sort((a, b) => a - b);
  return unique.every((n, i) => n === i + 1);
}

/** Appends the next variable placeholder to `text`. */
export function appendVariable(text) {
  const next = variableCount(text) + 1;
  const base = String(text || "");
  const needsSpace = base.length > 0 && !/\s$/.test(base);
  return `${base}${needsSpace ? " " : ""}{{${next}}}`;
}

/** Keeps the examples array the same length as the number of variables. */
export function syncExamples(text, examples = []) {
  const count = variableCount(text);
  const next = [];
  for (let i = 0; i < count; i += 1) {
    next.push(examples[i] ?? "");
  }
  return next;
}

/** Meta only accepts lowercase letters, digits and underscores in names. */
export function sanitizeTemplateName(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, LIMITS.nameMax);
}

/**
 * Validates the form and returns a list of errors. Each error has a `field`
 * (used to place the message in the UI) and a translation `key` under
 * `Templates.editor.errors`, plus optional `params`.
 */
export function validateTemplateForm(form, { name } = {}) {
  const errors = [];
  const push = (field, key, params) => errors.push({ field, key, params });

  if (name !== undefined) {
    const trimmed = String(name || "").trim();
    if (!trimmed) push("name", "nameRequired");
    else if (!/^[a-z0-9_]+$/.test(trimmed)) push("name", "nameFormat");
  }

  const header = form.header || {};
  if (header.type === "text") {
    const text = String(header.text || "").trim();
    if (!text) push("header", "headerTextRequired");
    if (text.length > LIMITS.headerTextMax)
      push("header", "headerTextTooLong", { max: LIMITS.headerTextMax });
    const vars = extractVariables(text);
    if (vars.length > 1 || (vars.length === 1 && vars[0] !== 1))
      push("header", "headerSingleVariable");
    if (vars.length === 1 && !String(header.textExample || "").trim())
      push("header", "headerExampleRequired");
  } else if (header.type === "image") {
    if (!isHttpUrl(header.imageUrl)) push("header", "headerImageUrl");
  } else if (header.type !== "none") {
    push("header", "headerTypeInvalid");
  }

  const bodyText = String(form.body?.text || "").trim();
  if (!bodyText) push("body", "bodyRequired");
  if (bodyText.length > LIMITS.bodyMax)
    push("body", "bodyTooLong", { max: LIMITS.bodyMax });
  if (!variablesAreSequential(bodyText)) push("body", "bodySequential");

  const bodyVarCount = variableCount(bodyText);
  const examples = form.body?.examples || [];
  for (let i = 0; i < bodyVarCount; i += 1) {
    if (!String(examples[i] || "").trim()) {
      push("bodyExamples", "bodyExampleRequired", { index: i + 1 });
    }
  }

  const footer = String(form.footer || "").trim();
  if (footer.length > LIMITS.footerMax)
    push("footer", "footerTooLong", { max: LIMITS.footerMax });
  if (extractVariables(footer).length > 0) push("footer", "footerNoVariables");

  const buttons = form.buttons || [];
  if (buttons.length > LIMITS.buttonsMax)
    push("buttons", "tooManyButtons", { max: LIMITS.buttonsMax });

  const urlButtons = buttons.filter((b) => b.type === "URL");
  if (urlButtons.length > LIMITS.urlButtonsMax)
    push("buttons", "tooManyUrlButtons", { max: LIMITS.urlButtonsMax });

  if (isInterleaved(buttons)) push("buttons", "buttonsGrouped");

  buttons.forEach((b, i) => {
    const field = `button:${b.id}`;
    const text = String(b.text || "").trim();
    if (!BUTTON_TYPES.includes(b.type)) push(field, "buttonTypeInvalid");
    if (!text) push(field, "buttonTextRequired", { index: i + 1 });
    if (text.length > LIMITS.buttonTextMax)
      push(field, "buttonTextTooLong", { max: LIMITS.buttonTextMax });

    if (b.type === "URL") {
      const url = String(b.url || "").trim();
      if (!isHttpUrl(url)) push(field, "buttonUrlInvalid");
      if (url.length > LIMITS.buttonUrlMax)
        push(field, "buttonUrlTooLong", { max: LIMITS.buttonUrlMax });
      const vars = extractVariables(url);
      if (vars.length > 1 || (vars.length === 1 && vars[0] !== 1))
        push(field, "buttonUrlSingleVariable");
      if (vars.length === 1 && !/\{\{\s*1\s*\}\}\s*$/.test(url))
        push(field, "buttonUrlVariableAtEnd");
      if (vars.length === 1 && !String(b.urlExample || "").trim())
        push(field, "buttonUrlExampleRequired");
    }
  });

  return errors;
}

/** Builds the provider components array from a (valid) form. */
export function buildTemplateComponents(form) {
  const components = [];
  const header = form.header || {};

  if (header.type === "text") {
    const text = String(header.text || "").trim();
    const component = { type: "HEADER", format: "TEXT", text };
    if (extractVariables(text).length > 0) {
      component.example = {
        header_text: [String(header.textExample || "").trim()],
      };
    }
    components.push(component);
  } else if (header.type === "image") {
    components.push({
      type: "HEADER",
      format: "IMAGE",
      example: { header_url: [String(header.imageUrl || "").trim()] },
    });
  }

  const bodyText = String(form.body?.text || "").trim();
  const body = { type: "BODY", text: bodyText };
  const count = variableCount(bodyText);
  if (count > 0) {
    const examples = syncExamples(bodyText, form.body?.examples).map((e) =>
      String(e || "").trim(),
    );
    body.example = { body_text: [examples] };
  }
  components.push(body);

  const footer = String(form.footer || "").trim();
  if (footer) components.push({ type: "FOOTER", text: footer });

  const buttons = (form.buttons || []).map((b) => {
    const text = String(b.text || "").trim();
    if (b.type === "URL") {
      const url = String(b.url || "").trim();
      const button = { type: "URL", text, url };
      if (extractVariables(url).length > 0) {
        button.example = { button_url: [String(b.urlExample || "").trim()] };
      }
      return button;
    }
    return { type: "QUICK_REPLY", text };
  });

  if (buttons.length > 0) components.push({ type: "BUTTONS", buttons });

  return components;
}

/**
 * Inverse of buildTemplateComponents, used to load the presets into the form.
 * Unknown component types are ignored.
 */
export function formFromComponents(components) {
  const form = emptyTemplateForm();
  for (const c of Array.isArray(components) ? components : []) {
    const type = String(c?.type || "").toUpperCase();
    if (type === "HEADER") {
      const format = String(c.format || "TEXT").toUpperCase();
      if (format === "IMAGE") {
        form.header = {
          type: "image",
          text: "",
          textExample: "",
          imageUrl: c.example?.header_url?.[0] || "",
        };
      } else if (format === "TEXT") {
        form.header = {
          type: "text",
          text: c.text || "",
          textExample: c.example?.header_text?.[0] || "",
          imageUrl: "",
        };
      }
    } else if (type === "BODY") {
      const text = c.text || "";
      form.body = {
        text,
        examples: syncExamples(text, c.example?.body_text?.[0] || []),
      };
    } else if (type === "FOOTER") {
      form.footer = c.text || "";
    } else if (type === "BUTTONS") {
      form.buttons = (c.buttons || [])
        .filter((b) => BUTTON_TYPES.includes(String(b.type).toUpperCase()))
        .map((b) =>
          makeButton(String(b.type).toUpperCase(), {
            text: b.text || "",
            url: b.url || "",
            urlExample: b.example?.button_url?.[0] || "",
          }),
        );
    }
  }
  return form;
}

/** Replaces {{n}} with values[n-1] when available; keeps the placeholder otherwise. */
export function interpolateExamples(text, values = []) {
  return String(text || "").replace(VARIABLE_RE, (match, n) => {
    const value = values[Number(n) - 1];
    return value && String(value).trim() ? String(value).trim() : match;
  });
}

/**
 * What the template will look like on the phone, using the example values
 * in place of the variables. Pure data so the preview component stays dumb.
 */
export function previewFromForm(form) {
  const header = form.header || {};
  let previewHeader = null;
  if (header.type === "text") {
    const text = interpolateExamples(header.text, [header.textExample]).trim();
    if (text) previewHeader = { type: "text", text };
  } else if (header.type === "image") {
    previewHeader = { type: "image", url: String(header.imageUrl || "").trim() };
  }

  const body = interpolateExamples(form.body?.text, form.body?.examples).trim();
  const footer = String(form.footer || "").trim();

  const buttons = (form.buttons || [])
    .map((b) => ({
      type: b.type,
      text: String(b.text || "").trim(),
      url:
        b.type === "URL"
          ? interpolateExamples(b.url, [b.urlExample]).trim()
          : "",
    }))
    .filter((b) => b.text);

  return {
    header: previewHeader,
    body,
    footer,
    buttons,
    isEmpty: !previewHeader && !body && !footer && buttons.length === 0,
  };
}

// ---------- Presets shown in the "Modelo" select ----------
export const PRESET_KEYS = [
  "text_quickreplies",
  "image_header_quickreplies",
  "quiz_url_button",
];

export function presetComponents(key) {
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

export function presetForm(key) {
  return formFromComponents(presetComponents(key));
}

// ---------- internals ----------
function isHttpUrl(value) {
  const v = String(value || "").trim();
  if (!/^https?:\/\//i.test(v)) return false;
  try {
    // Replace variable placeholders so the URL parser accepts them.
    new URL(v.replace(VARIABLE_RE, "x"));
    return true;
  } catch {
    return false;
  }
}

/** Meta requires quick replies and URL buttons to be grouped, not mixed. */
function isInterleaved(buttons) {
  let switches = 0;
  for (let i = 1; i < buttons.length; i += 1) {
    const prevIsQuick = buttons[i - 1].type === "QUICK_REPLY";
    const curIsQuick = buttons[i].type === "QUICK_REPLY";
    if (prevIsQuick !== curIsQuick) switches += 1;
  }
  return switches > 1;
}
