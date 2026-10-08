import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/openai/client", () => ({ openai: {} }));

import { generateBroadcastImage } from "@/lib/services/broadcast/generateBroadcastImage";

/* Uma imagem PNG verdadeira, pequena, como se viesse da OpenAI. */
async function pngBase64() {
  const png = await sharp({
    create: { width: 16, height: 16, channels: 3, background: "#25d366" },
  })
    .png()
    .toBuffer();

  return png.toString("base64");
}

function fakeOpenai(response) {
  return { images: { generate: vi.fn(() => Promise.resolve(response)) } };
}

const isJpeg = (buffer) =>
  buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

describe("generateBroadcastImage", () => {
  it("pede uma imagem quadrada em JPEG, com o pedido depois das regras", async () => {
    const client = fakeOpenai({ data: [{ b64_json: await pngBase64() }] });

    await generateBroadcastImage({
      prompt: "  equipa a celebrar o fim do projeto  ",
      deps: { openai: client },
    });

    const request = client.images.generate.mock.calls[0][0];
    expect(request).toMatchObject({
      model: "gpt-image-2.5-flare",
      size: "1024x1024",
      quality: "medium",
      output_format: "jpeg",
      n: 1,
    });
    expect(request.prompt).toContain("Sem texto escrito na imagem");
    expect(request.prompt.endsWith("Pedido: equipa a celebrar o fim do projeto")).toBe(true);
  });

  it("devolve sempre JPEG, mesmo que a OpenAI mande PNG", async () => {
    const client = fakeOpenai({
      data: [{ b64_json: await pngBase64() }],
      usage: { output_tokens: 1056 },
    });

    const result = await generateBroadcastImage({
      prompt: "um café",
      deps: { openai: client },
    });

    const bytes = Buffer.from(result.image, "base64");
    expect(isJpeg(bytes)).toBe(true);
    expect(result.contentType).toBe("image/jpeg");
    expect(result.usage).toEqual({ output_tokens: 1056 });
  });

  it("falha sem pedido, sem chamar a OpenAI", async () => {
    const client = fakeOpenai({});

    await expect(
      generateBroadcastImage({ prompt: "   ", deps: { openai: client } }),
    ).rejects.toThrow();
    expect(client.images.generate).not.toHaveBeenCalled();
  });

  it("falha quando a OpenAI não devolve imagem", async () => {
    await expect(
      generateBroadcastImage({
        prompt: "um café",
        deps: { openai: fakeOpenai({ data: [] }) },
      }),
    ).rejects.toThrow("A imagem não foi gerada.");
  });
});
