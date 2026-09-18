import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/openai/client", () => ({ openai: {} }));

import { suggestMessageText } from "@/lib/services/broadcast/suggestMessageText";

function fakeOpenai(text, status = "completed") {
  return {
    responses: {
      create: vi.fn(() =>
        Promise.resolve({ status, output_text: JSON.stringify({ text }) }),
      ),
    },
  };
}

describe("suggestMessageText", () => {
  it("asks for a draft without storing a conversation", async () => {
    const client = fakeOpenai(
      "Olá {{nome}}, sexta às 10h há formação digikal da Digik.",
    );

    const result = await suggestMessageText({
      organizationName: "DIGIK",
      kind: "message",
      prompt: "lembrar a formação de sexta às 10h",
      deps: { openai: client },
    });

    /* O nome da organização por extenso passa a ser a variável; só a palavra inteira. */
    expect(result.text).toBe(
      "Olá {{nome}}, sexta às 10h há formação digikal da {{empresa}}.",
    );

    const request = client.responses.create.mock.calls[0][0];
    expect(request.store).toBe(false);
    expect(request.instructions).toContain("{{empresa}}");
    expect(JSON.parse(request.input)).toEqual({
      pedido: "lembrar a formação de sexta às 10h",
      texto_atual: "",
    });
  });

  it("drops invented tokens but keeps the ones already in the text", async () => {
    const client = fakeOpenai(
      "Vê {{link.curso}} até {{data}}, {{nome}}.",
    );

    const result = await suggestMessageText({
      kind: "message",
      currentText: "Curso novo: {{link.curso}}",
      deps: { openai: client },
    });

    expect(result.text).toBe("Vê {{link.curso}} até, {{nome}}.");
  });

  it("fails without a request or when the draft is not usable", async () => {
    await expect(
      suggestMessageText({ deps: { openai: fakeOpenai("x") } }),
    ).rejects.toThrow();

    await expect(
      suggestMessageText({
        prompt: "algo",
        deps: { openai: fakeOpenai("a".repeat(1025)) },
      }),
    ).rejects.toThrow();
  });
});
