// @vitest-environment node

/**
 * Testes das predefinições de comportamento.
 *
 * São funções puras: entra um id, sai um conjunto de parâmetros. O que
 * se testa aqui não é aritmética — são as decisões que os valores
 * representam, e que se perdem facilmente numa afinação distraída.
 */

import { describe, it, expect } from "vitest";

import {
  ASSISTANT_PRESETS,
  DEFAULT_ASSISTANT_PRESET,
  getAssistantPreset,
  findPreset,
} from "@/app/[locale]/(app)/assistants/assistantPresets";

describe("predefinições de assistente", () => {
  it("tem três, com os ids que a interface espera", () => {
    expect(ASSISTANT_PRESETS.map((preset) => preset.id)).toEqual([
      "formal",
      "normal",
      "creative",
    ]);
  });

  it("só faz variar a temperatura", () => {
    /**
     * A OpenAI recomenda alterar a `temperature` OU o `top_p`, nunca os
     * dois: controlam aleatoriedade por mecanismos diferentes, e mexer
     * nos dois na mesma direção multiplica o efeito de forma
     * imprevisível.
     */
    const topPs = new Set(ASSISTANT_PRESETS.map((preset) => preset.top_p));

    expect(topPs.size).toBe(1);
    expect([...topPs][0]).toBe(1);
  });

  it("ordena as temperaturas do mais contido ao mais solto", () => {
    const [formal, normal, creative] = ASSISTANT_PRESETS;

    expect(formal.temperature).toBeLessThan(normal.temperature);
    expect(normal.temperature).toBeLessThan(creative.temperature);
  });

  it("mantém-se dentro da gama em que a qualidade aguenta", () => {
    // Acima de ~1.3 o texto começa a divagar; abaixo de 0.2 torna-se
    // repetitivo, às vezes em ciclo.
    for (const preset of ASSISTANT_PRESETS) {
      expect(preset.temperature).toBeGreaterThanOrEqual(0.2);
      expect(preset.temperature).toBeLessThanOrEqual(1.3);
    }
  });

  it("respeita os limites que a API aceita", () => {
    // temperature: 0 a 2. top_p: 0 a 1. Não são a mesma escala — é por
    // isso que estas predefinições não se definem em percentagem.
    for (const preset of ASSISTANT_PRESETS) {
      expect(preset.temperature).toBeGreaterThanOrEqual(0);
      expect(preset.temperature).toBeLessThanOrEqual(2);
      expect(preset.top_p).toBeGreaterThanOrEqual(0);
      expect(preset.top_p).toBeLessThanOrEqual(1);
    }
  });

  it("devolve a predefinição pedida", () => {
    expect(getAssistantPreset("formal").temperature).toBe(0.2);
    expect(getAssistantPreset("normal").temperature).toBe(0.7);
    expect(getAssistantPreset("creative").temperature).toBe(1.1);
  });

  it("cai na de omissão perante um id desconhecido", () => {
    // Um id errado não pode dar um assistente sem temperatura: isso
    // seria pior do que um assistente equilibrado.
    expect(getAssistantPreset("banana").id).toBe(DEFAULT_ASSISTANT_PRESET);
    expect(getAssistantPreset(undefined).id).toBe(DEFAULT_ASSISTANT_PRESET);
    expect(getAssistantPreset(null).temperature).toBe(0.7);
  });

  it("reconhece a predefinicao de um assistente ja criado", () => {
    expect(findPreset({ temperature: 0.2, top_p: 1 }).id).toBe("formal");
    expect(findPreset({ temperature: "1.1", top_p: "1" }).id).toBe("creative");
  });

  it("trata um top_p por preencher como o valor por omissao", () => {
    // A API usa 1 quando nao lhe mandamos nada, por isso e o que o
    // assistente tem na pratica.
    expect(findPreset({ temperature: 0.7 }).id).toBe("normal");
    expect(findPreset({ temperature: 0.7, top_p: null }).id).toBe("normal");
  });

  it("nao inventa predefinicao para valores afinados a mao", () => {
    // Qualquer assistente anterior a esta mudanca tem valores fora
    // destes. Dizer que e "Normal" seria mentir sobre o que ele faz.
    expect(findPreset({ temperature: 0.45 })).toBeNull();
    expect(findPreset({ temperature: null })).toBeNull();
    expect(findPreset({})).toBeNull();
    expect(findPreset()).toBeNull();
  });

  it("nao chama Normal a um assistente com o top_p mexido", () => {
    // A temperatura bate certo, o top_p nao: o comportamento e outro.
    expect(findPreset({ temperature: 0.7, top_p: 0.35 })).toBeNull();
  });
});
