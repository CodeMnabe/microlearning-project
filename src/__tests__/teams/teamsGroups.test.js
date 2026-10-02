// @vitest-environment node
import { describe, expect, it } from "vitest";
import { stripBotMention } from "@/lib/teams/mentions";

describe("stripBotMention", () => {
  it("tira a menção ao bot e deixa os comandos chegar intactos", () => {
    const activity = {
      text: "<at>MyDigitalBot</at>&nbsp;--help",
      recipient: { id: "28:bot" },
      entities: [
        { type: "mention", text: "<at>MyDigitalBot</at>", mentioned: { id: "28:bot" } },
      ],
    };

    expect(stripBotMention(activity)).toBe("--help");
  });

  it("mantém o nome das outras pessoas mencionadas", () => {
    const activity = {
      text: "<at>MyDigitalBot</at> o que achas da ideia da <at>Ana Silva</at>?",
      recipient: { id: "28:bot" },
      entities: [
        { type: "mention", text: "<at>MyDigitalBot</at>", mentioned: { id: "28:bot" } },
        { type: "mention", text: "<at>Ana Silva</at>", mentioned: { id: "29:ana" } },
      ],
    };

    expect(stripBotMention(activity)).toBe("o que achas da ideia da Ana Silva?");
  });
});
