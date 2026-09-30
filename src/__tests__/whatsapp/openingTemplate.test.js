import { describe, expect, it } from "vitest";

import {
  DEFAULT_OPENING_BODY,
  OPENING_TEMPLATE_OUTRO,
  buildOpeningTemplateParams,
  getOpeningTemplateConfig,
  renderOpeningMessage,
  resolveOpeningBody,
  sanitizeOpeningBody,
} from "@/lib/whatsapp/openingTemplate";

describe("sanitizeOpeningBody", () => {
  it("collapses line breaks, tabs and repeated spaces into one space", () => {
    expect(sanitizeOpeningBody("  Olá\n\n  a   todos\tvocês  ")).toBe(
      "Olá a todos vocês",
    );
  });

  it("treats null and undefined as empty", () => {
    expect(sanitizeOpeningBody(null)).toBe("");
    expect(sanitizeOpeningBody(undefined)).toBe("");
  });
});

describe("resolveOpeningBody", () => {
  it("falls back to the default body when the organization has none", () => {
    expect(resolveOpeningBody("")).toBe(DEFAULT_OPENING_BODY);
    expect(resolveOpeningBody("   ")).toBe(DEFAULT_OPENING_BODY);
    expect(resolveOpeningBody(null)).toBe(DEFAULT_OPENING_BODY);
  });

  it("keeps the organization body when present", () => {
    expect(resolveOpeningBody("Texto próprio")).toBe("Texto próprio");
  });
});

describe("renderOpeningMessage", () => {
  it("fills name and company and keeps the fixed start and end", () => {
    const text = renderOpeningMessage({
      name: "Pedro",
      orgName: "DIGIK",
      body: "Corpo à medida",
    });

    expect(text).toBe(
      `Olá Pedro!\n\nDesejas receber comunicações da DIGIK?\n\nCorpo à medida\n\n${OPENING_TEMPLATE_OUTRO}`,
    );
  });

  it("uses the default body when none is given", () => {
    expect(renderOpeningMessage({ name: "Ana", orgName: "ASP" })).toContain(
      DEFAULT_OPENING_BODY,
    );
  });
});

describe("buildOpeningTemplateParams", () => {
  it("returns the three template variables in order", () => {
    expect(
      buildOpeningTemplateParams({
        userName: "Pedro",
        orgName: "DIGIK",
        body: "Corpo",
      }),
    ).toEqual(["nome=Pedro", "empresa=DIGIK", "mensagem=Corpo"]);
  });

  it("never sends an empty body", () => {
    const params = buildOpeningTemplateParams({
      userName: "Pedro",
      orgName: "DIGIK",
      body: "",
    });

    expect(params[2]).toBe(`mensagem=${DEFAULT_OPENING_BODY}`);
  });
});

describe("getOpeningTemplateConfig", () => {
  it("reads the project id and locale from the environment", () => {
    expect(
      getOpeningTemplateConfig({
        BIRD_OPENING_TEMPLATE_PROJECT_ID: " proj-1 ",
        BIRD_OPENING_TEMPLATE_LOCALE: "en",
      }),
    ).toEqual({ projectId: "proj-1", locale: "en" });
  });

  it("defaults the locale to pt-PT", () => {
    expect(
      getOpeningTemplateConfig({ BIRD_OPENING_TEMPLATE_PROJECT_ID: "p" })
        .locale,
    ).toBe("pt-PT");
  });

  it("fails loudly when the project id is missing", () => {
    expect(() => getOpeningTemplateConfig({})).toThrow(
      /BIRD_OPENING_TEMPLATE_PROJECT_ID/,
    );
  });
});
