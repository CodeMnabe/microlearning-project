import { describe, it, expect } from "vitest";

import {
  appendVariable,
  buildTemplateComponents,
  emptyTemplateForm,
  extractVariables,
  formFromComponents,
  interpolateExamples,
  makeButton,
  presetComponents,
  previewFromForm,
  presetForm,
  sanitizeTemplateName,
  syncExamples,
  validateTemplateForm,
  variablesAreSequential,
  PRESET_KEYS,
} from "@/app/[locale]/(app)/templates/lib/templateComponents";

function validForm() {
  const form = emptyTemplateForm();
  form.body = { text: "Olá {{1}}, dica: {{2}}", examples: ["João", "Pneus"] };
  return form;
}

function keys(errors) {
  return errors.map((e) => e.key);
}

describe("variables", () => {
  it("extracts variable numbers in order", () => {
    expect(extractVariables("a {{2}} b {{1}} c {{ 3 }}")).toEqual([2, 1, 3]);
    expect(extractVariables("")).toEqual([]);
  });

  it("detects gaps in the numbering", () => {
    expect(variablesAreSequential("{{1}} {{2}}")).toBe(true);
    expect(variablesAreSequential("{{1}} {{3}}")).toBe(false);
    expect(variablesAreSequential("{{2}}")).toBe(false);
    expect(variablesAreSequential("no vars")).toBe(true);
  });

  it("appends the next placeholder with a separating space", () => {
    expect(appendVariable("")).toBe("{{1}}");
    expect(appendVariable("Olá")).toBe("Olá {{1}}");
    expect(appendVariable("Olá {{1}} ")).toBe("Olá {{1}} {{2}}");
  });

  it("keeps examples aligned with the variable count", () => {
    expect(syncExamples("{{1}} {{2}}", ["a"])).toEqual(["a", ""]);
    expect(syncExamples("{{1}}", ["a", "b"])).toEqual(["a"]);
  });
});

describe("sanitizeTemplateName", () => {
  it("lowercases and replaces spaces and dashes with underscores", () => {
    expect(sanitizeTemplateName("Dica Semanal-V1")).toBe("dica_semanal_v1");
    expect(sanitizeTemplateName("olá!! mundo")).toBe("ol_mundo");
  });
});

describe("validateTemplateForm", () => {
  it("accepts a minimal valid form", () => {
    expect(validateTemplateForm(validForm(), { name: "dica_v1" })).toEqual([]);
  });

  it("requires a body", () => {
    const form = emptyTemplateForm();
    expect(keys(validateTemplateForm(form))).toContain("bodyRequired");
  });

  it("requires an example for every body variable", () => {
    const form = validForm();
    form.body.examples = ["João", ""];
    const errors = validateTemplateForm(form);
    expect(errors).toEqual([
      { field: "bodyExamples", key: "bodyExampleRequired", params: { index: 2 } },
    ]);
  });

  it("rejects non-sequential variables", () => {
    const form = validForm();
    form.body = { text: "{{1}} e {{3}}", examples: ["a", "b", "c"] };
    expect(keys(validateTemplateForm(form))).toContain("bodySequential");
  });

  it("validates the name format", () => {
    expect(keys(validateTemplateForm(validForm(), { name: "" }))).toContain(
      "nameRequired",
    );
    expect(keys(validateTemplateForm(validForm(), { name: "Bad Name" }))).toContain(
      "nameFormat",
    );
  });

  it("validates a text header", () => {
    const form = validForm();
    form.header = { type: "text", text: "", textExample: "", imageUrl: "" };
    expect(keys(validateTemplateForm(form))).toContain("headerTextRequired");

    form.header.text = "Olá {{1}}";
    expect(keys(validateTemplateForm(form))).toContain("headerExampleRequired");

    form.header.text = "Olá {{1}} {{2}}";
    expect(keys(validateTemplateForm(form))).toContain("headerSingleVariable");

    form.header = { type: "text", text: "x".repeat(61), textExample: "" };
    expect(keys(validateTemplateForm(form))).toContain("headerTextTooLong");
  });

  it("validates an image header", () => {
    const form = validForm();
    form.header = { type: "image", text: "", textExample: "", imageUrl: "" };
    expect(keys(validateTemplateForm(form))).toContain("headerImageUrl");

    form.header.imageUrl = "https://cdn.example.com/a.jpg";
    expect(validateTemplateForm(form)).toEqual([]);
  });

  it("rejects variables and long text in the footer", () => {
    const form = validForm();
    form.footer = "{{1}}";
    expect(keys(validateTemplateForm(form))).toContain("footerNoVariables");
    form.footer = "x".repeat(61);
    expect(keys(validateTemplateForm(form))).toContain("footerTooLong");
  });

  it("validates buttons", () => {
    const form = validForm();
    const quick = makeButton("QUICK_REPLY", { text: "" });
    form.buttons = [quick];
    expect(validateTemplateForm(form)).toEqual([
      {
        field: `button:${quick.id}`,
        key: "buttonTextRequired",
        params: { index: 1 },
      },
    ]);

    const url = makeButton("URL", { text: "Abrir", url: "not a url" });
    form.buttons = [url];
    expect(keys(validateTemplateForm(form))).toContain("buttonUrlInvalid");

    url.url = "https://x.com/{{1}}/page";
    expect(keys(validateTemplateForm(form))).toContain("buttonUrlVariableAtEnd");

    url.url = "https://x.com/{{1}}";
    expect(keys(validateTemplateForm(form))).toContain("buttonUrlExampleRequired");

    url.urlExample = "abc";
    expect(validateTemplateForm(form)).toEqual([]);
  });

  it("rejects interleaved quick replies and URL buttons", () => {
    const form = validForm();
    form.buttons = [
      makeButton("QUICK_REPLY", { text: "A" }),
      makeButton("URL", { text: "Site", url: "https://x.com" }),
      makeButton("QUICK_REPLY", { text: "B" }),
    ];
    expect(keys(validateTemplateForm(form))).toContain("buttonsGrouped");

    form.buttons = [
      makeButton("QUICK_REPLY", { text: "A" }),
      makeButton("QUICK_REPLY", { text: "B" }),
      makeButton("URL", { text: "Site", url: "https://x.com" }),
    ];
    expect(validateTemplateForm(form)).toEqual([]);
  });

  it("limits the number of buttons", () => {
    const form = validForm();
    form.buttons = Array.from({ length: 11 }, (_, i) =>
      makeButton("QUICK_REPLY", { text: `B${i}` }),
    );
    expect(keys(validateTemplateForm(form))).toContain("tooManyButtons");

    form.buttons = Array.from({ length: 3 }, (_, i) =>
      makeButton("URL", { text: `U${i}`, url: "https://x.com" }),
    );
    expect(keys(validateTemplateForm(form))).toContain("tooManyUrlButtons");
  });
});

describe("buildTemplateComponents", () => {
  it("builds body only when nothing else is set", () => {
    const form = emptyTemplateForm();
    form.body.text = "Sem variáveis";
    expect(buildTemplateComponents(form)).toEqual([
      { type: "BODY", text: "Sem variáveis" },
    ]);
  });

  it("adds body examples only when there are variables", () => {
    expect(buildTemplateComponents(validForm())).toEqual([
      {
        type: "BODY",
        text: "Olá {{1}}, dica: {{2}}",
        example: { body_text: [["João", "Pneus"]] },
      },
    ]);
  });

  it("builds header, footer and buttons", () => {
    const form = validForm();
    form.header = {
      type: "text",
      text: "Olá {{1}}",
      textExample: "João",
      imageUrl: "",
    };
    form.footer = "Responda STOP";
    form.buttons = [
      makeButton("QUICK_REPLY", { text: "Ver mais" }),
      makeButton("URL", {
        text: "Abrir",
        url: "https://x.com/{{1}}",
        urlExample: "abc",
      }),
    ];

    expect(buildTemplateComponents(form)).toEqual([
      {
        type: "HEADER",
        format: "TEXT",
        text: "Olá {{1}}",
        example: { header_text: ["João"] },
      },
      {
        type: "BODY",
        text: "Olá {{1}}, dica: {{2}}",
        example: { body_text: [["João", "Pneus"]] },
      },
      { type: "FOOTER", text: "Responda STOP" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Ver mais" },
          {
            type: "URL",
            text: "Abrir",
            url: "https://x.com/{{1}}",
            example: { button_url: ["abc"] },
          },
        ],
      },
    ]);
  });

  it("builds an image header with the example URL", () => {
    const form = validForm();
    form.header = {
      type: "image",
      text: "",
      textExample: "",
      imageUrl: "https://cdn.example.com/a.jpg",
    };
    expect(buildTemplateComponents(form)[0]).toEqual({
      type: "HEADER",
      format: "IMAGE",
      example: { header_url: ["https://cdn.example.com/a.jpg"] },
    });
  });

  it("round-trips every preset unchanged", () => {
    for (const key of PRESET_KEYS) {
      const original = presetComponents(key);
      expect(validateTemplateForm(presetForm(key))).toEqual([]);
      expect(buildTemplateComponents(formFromComponents(original))).toEqual(
        original,
      );
    }
  });
});

describe("previewFromForm", () => {
  it("interpolates examples and keeps placeholders without a value", () => {
    expect(interpolateExamples("Olá {{1}}, {{2}}", ["João", ""])).toBe(
      "Olá João, {{2}}",
    );
  });

  it("is empty for a blank form", () => {
    expect(previewFromForm(emptyTemplateForm()).isEmpty).toBe(true);
  });

  it("renders header, body, footer and buttons with example values", () => {
    const form = validForm();
    form.header = {
      type: "text",
      text: "Olá {{1}}",
      textExample: "João",
      imageUrl: "",
    };
    form.footer = "Responda STOP";
    form.buttons = [
      makeButton("QUICK_REPLY", { text: "Ver mais" }),
      makeButton("URL", {
        text: "Abrir",
        url: "https://x.com/{{1}}",
        urlExample: "abc",
      }),
      makeButton("QUICK_REPLY", { text: "" }),
    ];

    expect(previewFromForm(form)).toEqual({
      header: { type: "text", text: "Olá João" },
      body: "Olá João, dica: Pneus",
      footer: "Responda STOP",
      buttons: [
        { type: "QUICK_REPLY", text: "Ver mais", url: "" },
        { type: "URL", text: "Abrir", url: "https://x.com/abc" },
      ],
      isEmpty: false,
    });
  });

  it("describes an image header", () => {
    const form = validForm();
    form.header = {
      type: "image",
      text: "",
      textExample: "",
      imageUrl: "https://cdn.example.com/a.jpg",
    };
    expect(previewFromForm(form).header).toEqual({
      type: "image",
      url: "https://cdn.example.com/a.jpg",
    });
  });
});
