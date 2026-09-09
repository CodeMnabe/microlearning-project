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
  findPresetByTemperature,
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

  it("reconhece a predefinição de um assistente já criado", () => {
    expect(findPresetByTemperature(0.2).id).toBe("formal");
    expect(findPresetByTemperature("1.1").id).toBe("creative");
  });

  it("não inventa predefinição para valores afinados à mão", () => {
    // Qualquer assistente anterior a esta mudança tem valores fora
    // destes. Dizer que é "Normal" seria mentir sobre o que ele faz.
    expect(findPresetByTemperature(0.45)).toBeNull();
    expect(findPresetByTemperature(null)).toBeNull();
    expect(findPresetByTemperature(undefined)).toBeNull();
  });
});
