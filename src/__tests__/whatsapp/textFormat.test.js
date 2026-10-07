import { describe, expect, it } from "vitest";

import {
  formatNodesToText,
  parseWhatsappFormat,
  toTeamsMarkdown,
} from "@/lib/whatsapp/textFormat";

const text = (value) => ({ type: "text", value });

describe("parseWhatsappFormat", () => {
  it("lê negrito, itálico, riscado e monoespaçado", () => {
    expect(
      parseWhatsappFormat("*Olá* _tu_ ~não~ ```código```"),
    ).toEqual([
      { type: "bold", children: [text("Olá")] },
      text(" "),
      { type: "italic", children: [text("tu")] },
      text(" "),
      { type: "strike", children: [text("não")] },
      text(" "),
      { type: "mono", value: "código" },
    ]);
  });

  it("aceita formatação dentro de formatação", () => {
    expect(parseWhatsappFormat("*_ambos_*")).toEqual([
      { type: "bold", children: [{ type: "italic", children: [text("ambos")] }] },
    ]);
  });

  it("dentro do monoespaçado não há formatação", () => {
    expect(parseWhatsappFormat("```a *b* c```")).toEqual([
      { type: "mono", value: "a *b* c" },
    ]);
  });

  it("mantém as variáveis e os links dentro da formatação", () => {
    expect(parseWhatsappFormat("*Olá {{nome}}*")).toEqual([
      { type: "bold", children: [text("Olá {{nome}}")] },
    ]);
  });

  it.each([
    ["dentro de uma palavra", "nome_completo e var_x"],
    ["entre números", "5*3*2"],
    ["com espaço a seguir ao marcador", "* não é negrito *"],
    ["numa lista", "* primeiro\n* segundo"],
    ["entre linhas", "*começa\nacaba*"],
    ["sem conteúdo", "** e __"],
    ["sem fechar", "*aberto"],
    ["numa chave de link", "{{link.curso_excel}}"],
  ])("não formata %s", (_, value) => {
    expect(parseWhatsappFormat(value)).toEqual([text(value)]);
  });

  it("pontuação antes e depois do marcador não impede a formatação", () => {
    expect(parseWhatsappFormat("(*sim*).")).toEqual([
      text("("),
      { type: "bold", children: [text("sim")] },
      text(")."),
    ]);
  });
});

describe("formatNodesToText", () => {
  it.each([
    "*Olá* _tu_ ~não~ ```código```",
    "*_ambos_*",
    "Linha 1\n*Linha 2*",
    "nome_completo 5*3*2",
    "* lista\n- outra\n1. três\n> citação",
  ])("volta a dar o mesmo texto: %j", (value) => {
    expect(formatNodesToText(parseWhatsappFormat(value))).toBe(value);
  });
});

describe("toTeamsMarkdown", () => {
  it("converte os marcadores do WhatsApp para Markdown", () => {
    expect(toTeamsMarkdown("*Olá* _tu_ ~não~ ```código```")).toBe(
      "**Olá** <i>tu</i> <s>não</s> `código`",
    );
  });

  it("converte formatação dentro de formatação", () => {
    expect(toTeamsMarkdown("*_ambos_*")).toBe("**<i>ambos</i>**");
    expect(toTeamsMarkdown("~*riscado e negrito*~")).toBe(
      "<s>**riscado e negrito**</s>",
    );
  });

  it("monoespaçado com várias linhas vira um bloco de código", () => {
    expect(toTeamsMarkdown("```linha 1\nlinha 2```")).toBe(
      "```\nlinha 1\nlinha 2\n```",
    );
  });

  it("não mexe em texto sem formatação, listas ou citações", () => {
    const value = "Olá {{nome}}\n- um\n1. dois\n> três\n5*3*2";
    expect(toTeamsMarkdown(value)).toBe(value);
  });
});
