import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import useImageSuggestion, {
  imageToFile,
} from "@/app/[locale]/(app)/broadcast/hooks/useImageSuggestion";

/* "QUJD" é "ABC" em base64. */
const IMAGE = { image: "QUJD", contentType: "image/jpeg" };

function answer(body, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 502,
    json: () => Promise.resolve(body),
  });
}

function renderSuggestion({ onUse = vi.fn(), resetKey = "a" } = {}) {
  const hook = renderHook(
    (props) => useImageSuggestion({ orgId: 7, onUse, ...props }),
    { initialProps: { resetKey } },
  );
  return { ...hook, onUse };
}

async function askFor(result, prompt) {
  act(() => {
    result.current.open();
    result.current.setPrompt(prompt);
  });
  await act(() => result.current.ask());
}

describe("useImageSuggestion", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => answer(IMAGE)));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("pede a imagem com o pedido limpo e mostra-a no balão", async () => {
    const { result } = renderSuggestion();

    await askFor(result, "  equipa a celebrar  ");

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("/api/broadcast/image");
    expect(JSON.parse(options.body)).toEqual({
      orgId: 7,
      prompt: "equipa a celebrar",
    });
    expect(result.current.imageUrl).toBe("data:image/jpeg;base64,QUJD");
    expect(result.current.showsInBubble).toBe(true);
  });

  it("sem pedido não chama a IA", async () => {
    const { result } = renderSuggestion();

    await askFor(result, "   ");

    expect(fetch).not.toHaveBeenCalled();
  });

  it("enquanto cria, o balão mostra a espera", async () => {
    let finish;
    fetch.mockImplementation(
      () => new Promise((resolve) => (finish = () => resolve(answer(IMAGE)))),
    );
    const { result } = renderSuggestion();

    act(() => {
      result.current.open();
      result.current.setPrompt("um café");
    });
    act(() => {
      result.current.ask();
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.showsInBubble).toBe(true);

    await act(async () => finish());
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("Usar passa a imagem como um ficheiro JPEG e fecha", async () => {
    const { result, onUse } = renderSuggestion();
    await askFor(result, "um café");

    await act(() => result.current.accept());

    const file = onUse.mock.calls[0][0];
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe("image/jpeg");
    expect(file.name).toMatch(/^imagem-ia-\d+\.jpg$/);
    expect(result.current.active).toBe(false);
    expect(result.current.imageUrl).toBeNull();
  });

  it("se não conseguir juntar a imagem, ela fica para tentar outra vez", async () => {
    const onUse = vi.fn(() => Promise.reject(new Error("upload")));
    const { result } = renderSuggestion({ onUse });
    await askFor(result, "um café");

    await act(() => result.current.accept());

    expect(result.current.error).toBe("save");
    expect(result.current.imageUrl).toBe("data:image/jpeg;base64,QUJD");
    expect(result.current.active).toBe(true);
  });

  it("se a IA falhar, o balão diz que não foi possível", async () => {
    fetch.mockImplementation(() => answer({ error: "failed" }, false));
    const { result } = renderSuggestion();

    await askFor(result, "um café");

    expect(result.current.error).toBe("generate");
    expect(result.current.showsInBubble).toBe(true);
  });

  it("Descartar tira a proposta e volta ao pedido", async () => {
    const { result } = renderSuggestion();
    await askFor(result, "um café");

    act(() => result.current.discardImage());

    expect(result.current.imageUrl).toBeNull();
    expect(result.current.showsInBubble).toBe(false);
    expect(result.current.active).toBe(true);
  });

  it("mudar de tipo de mensagem fecha a criação", async () => {
    const { result, rerender } = renderSuggestion();
    await askFor(result, "um café");

    rerender({ resetKey: "b" });

    expect(result.current.active).toBe(false);
    expect(result.current.imageUrl).toBeNull();
  });
});

describe("imageToFile", () => {
  it("passa o base64 para os bytes da imagem", async () => {
    const file = imageToFile(IMAGE, 123);

    const text = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(file);
    });

    expect(file.name).toBe("imagem-ia-123.jpg");
    expect(text).toBe("ABC");
  });
});
