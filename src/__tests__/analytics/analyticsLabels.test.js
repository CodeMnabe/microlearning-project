// @vitest-environment node

/**
 * Guarda contra cabeçalhos em branco no Excel.
 *
 * O construtor do livro pede etiquetas por nome — `columns.rule`,
 * `columns.assistant`. Se a chave não existir, o JavaScript devolve
 * `undefined` sem se queixar, o ExcelJS escreve uma célula vazia, e o
 * ficheiro sai com uma coluna sem título.
 *
 * Aconteceu duas vezes: a folha de Execuções ficou sem o cabeçalho
 * "Regra" desde que foi escrita, e a coluna "Assistente" nasceu vazia
 * porque a chave entrou no JSON mas não na lista de tradução.
 *
 * Este teste lê o código do construtor, extrai as chaves que ele usa, e
 * confirma que cada uma existe nos dois sítios. É a única forma de
 * apanhar isto sem alguém abrir o ficheiro e olhar.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";

import pt from "@/messages/pt.json";
import en from "@/messages/en.json";

const EXCEL = "src/app/[locale]/(app)/analytics/lib/analytics.excel.js";
const HELPERS = "src/app/[locale]/(app)/analytics/lib/analytics.helpers.js";

/** As chaves que o construtor pede, lidas do próprio código. */
function keysUsedByBuilder() {
  const source = fs.readFileSync(EXCEL, "utf8");

  return [
    ...new Set(
      [...source.matchAll(/header: columns\.(\w+)/g)].map((m) => m[1]),
    ),
  ].sort();
}

/** As chaves que o buildExcelLabels traduz. */
function keysTranslated() {
  const source = fs.readFileSync(HELPERS, "utf8");
  const start = source.indexOf("const detailKeys");
  const block = source.slice(start, source.indexOf("];", start));

  return new Set([...block.matchAll(/"(\w+)"/g)].map((m) => m[1]));
}

describe("etiquetas das folhas de detalhe", () => {
  const used = keysUsedByBuilder();

  it("o construtor usa etiquetas a sério", () => {
    // Se este número cair para zero, a extração deixou de funcionar e
    // os testes abaixo passariam sem verificar nada.
    expect(used.length).toBeGreaterThan(20);
  });

  it("todas as chaves usadas são traduzidas", () => {
    const translated = keysTranslated();
    const missing = used.filter((key) => !translated.has(key));

    expect(missing, `sem tradução em buildExcelLabels: ${missing}`).toEqual([]);
  });

  it("todas as chaves existem em português", () => {
    const labels = pt.Analytics.excel.detail;
    const missing = used.filter((key) => !(key in labels));

    expect(missing, `sem chave em pt.json: ${missing}`).toEqual([]);
  });

  it("todas as chaves existem em inglês", () => {
    const labels = en.Analytics.excel.detail;
    const missing = used.filter((key) => !(key in labels));

    expect(missing, `sem chave em en.json: ${missing}`).toEqual([]);
  });

  it("nenhuma etiqueta está vazia", () => {
    for (const [lang, labels] of [
      ["pt", pt.Analytics.excel.detail],
      ["en", en.Analytics.excel.detail],
    ]) {
      const empty = Object.entries(labels)
        .filter(([, value]) => !String(value).trim())
        .map(([key]) => key);

      expect(empty, `etiquetas vazias em ${lang}: ${empty}`).toEqual([]);
    }
  });

  it("os dois idiomas têm as mesmas chaves", () => {
    const a = Object.keys(pt.Analytics.excel.detail).sort();
    const b = Object.keys(en.Analytics.excel.detail).sort();

    expect(a).toEqual(b);
  });
});
