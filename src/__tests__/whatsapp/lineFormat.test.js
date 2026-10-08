import { describe, expect, it } from "vitest";

import {
  breakListLine,
  removeListPrefix,
  toggleLinePrefixInText,
} from "@/lib/whatsapp/lineFormat";

/* O texto com "|" onde está o cursor, partido em antes e depois. */
function at(textWithCaret) {
  const [before, after] = textWithCaret.split("|");
  return [before, after];
}

/* O resultado com "|" onde fica o cursor, para ler os testes de relance. */
function show(result) {
  if (!result) return result;

  const lines = result.text.split("\n");
  const line = lines[result.line];
  lines[result.line] = `${line.slice(0, result.column)}|${line.slice(result.column)}`;
  return lines.join("\n");
}

describe("toggleLinePrefixInText", () => {
  it("põe a lista de tarefas com o quadrado", () => {
    expect(toggleLinePrefixInText("a\nb", "task", 0, 1)).toBe("☐ a\n☐ b");
  });

  it("troca a lista de tarefas pela de marcadores sem ficar com as duas", () => {
    expect(toggleLinePrefixInText("☐ a", "bullet", 0, 0)).toBe("- a");
  });

  it("uma linha numerada a seguir a uma lista continua a numeração", () => {
    expect(toggleLinePrefixInText("1. a\n2. b\nc", "numbered", 2, 2)).toBe(
      "1. a\n2. b\n3. c",
    );
  });

  it("tirar um item a meio parte a lista e a segunda recomeça no 1", () => {
    expect(toggleLinePrefixInText("1. a\n2. b\n3. c", "numbered", 1, 1)).toBe(
      "1. a\nb\n1. c",
    );
  });

  it("não mexe em linhas numeradas longe das que mudaram", () => {
    expect(toggleLinePrefixInText("2026. Ano novo\n\na", "numbered", 2, 2)).toBe(
      "2026. Ano novo\n\n1. a",
    );
  });
});

describe("breakListLine (Enter)", () => {
  it.each([
    ["- um|", "- um\n- |"],
    ["* um|", "* um\n* |"],
    ["☐ um|", "☐ um\n☐ |"],
    ["1. um|", "1. um\n2. |"],
  ])("continua a lista: %s", (text, expected) => {
    expect(show(breakListLine(...at(text)))).toBe(expected);
  });

  it("um item novo a meio numera de novo os seguintes", () => {
    expect(show(breakListLine(...at("1. um|\n2. dois")))).toBe(
      "1. um\n2. |\n3. dois",
    );
  });

  it("a meio do texto, o que está depois do cursor passa para o item novo", () => {
    expect(show(breakListLine(...at("- olá |mundo")))).toBe("- olá \n- |mundo");
  });

  it("a meio de um negrito, cada lado fica com a sua marca", () => {
    /* O editor dá o texto já cortado assim: "*o*" antes, "*lá*" depois. */
    expect(show(breakListLine("- *o*", "*lá*"))).toBe("- *o*\n- |*lá*");
  });

  it("com o cursor antes do prefixo, o item vazio fica por cima", () => {
    expect(show(breakListLine(...at("|- um")))).toBe("- \n- |um");
  });

  it("num item vazio, sai da lista", () => {
    expect(show(breakListLine(...at("- um\n- |")))).toBe("- um\n|");
  });

  it("ao sair a meio de uma lista numerada, a parte de baixo recomeça no 1", () => {
    expect(show(breakListLine(...at("1. a\n2. |\n3. b")))).toBe(
      "1. a\n|\n1. b",
    );
  });

  it("fora de uma lista não faz nada (o Enter é o normal)", () => {
    expect(breakListLine(...at("olá|"))).toBeNull();
    expect(breakListLine(...at("> citação|"))).toBeNull();
  });
});

describe("removeListPrefix (Backspace)", () => {
  it("logo a seguir ao prefixo, a linha sai da lista", () => {
    expect(show(removeListPrefix(...at("- a\n- |b")))).toBe("- a\n|b");
  });

  it("numa lista numerada, os itens de baixo recomeçam no 1", () => {
    expect(show(removeListPrefix(...at("1. a\n2. |b\n3. c")))).toBe(
      "1. a\n|b\n1. c",
    );
  });

  it("noutro sítio da linha, o Backspace apaga como sempre", () => {
    expect(removeListPrefix(...at("- a|b"))).toBeNull();
    expect(removeListPrefix(...at("olá|"))).toBeNull();
  });
});
