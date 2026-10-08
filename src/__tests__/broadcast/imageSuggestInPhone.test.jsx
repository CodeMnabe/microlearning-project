import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PlusMenu, {
  PlusMenuBar,
} from "@/app/[locale]/(app)/broadcast/components/PlusMenu";
import { ImageSuggestBubble } from "@/app/[locale]/(app)/broadcast/components/ImageSuggestInPhone";

const translation = (key) => key;

function imageSuggest(overrides = {}) {
  return {
    active: true,
    prompt: "equipa a celebrar",
    setPrompt: vi.fn(),
    close: vi.fn(),
    ask: vi.fn(),
    accept: vi.fn(),
    discardImage: vi.fn(),
    imageUrl: "data:image/jpeg;base64,QUJD",
    loading: false,
    saving: false,
    error: null,
    ...overrides,
  };
}

describe("Criar imagem no telemóvel", () => {
  it("o + tem a opção Criar imagem", () => {
    const onCreateImage = vi.fn();
    render(
      <PlusMenu
        onAddFile={vi.fn()}
        onCreateImage={onCreateImage}
        translation={translation}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Broadcast.composer.add" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Broadcast.image.title" }));

    expect(onCreateImage).toHaveBeenCalled();
  });

  it("com a criação aberta, a barra de baixo é o campo do pedido", () => {
    const suggest = imageSuggest({ imageUrl: null });
    render(<PlusMenuBar tools={{ imageSuggest: suggest }} translation={translation} />);

    const input = screen.getByRole("textbox", { name: "Broadcast.image.promptLabel" });
    expect(input.getAttribute("placeholder")).toBe("Broadcast.image.placeholder");

    fireEvent.submit(input.closest("form"));
    expect(suggest.ask).toHaveBeenCalled();
  });

  it("enquanto cria, o balão mostra a espera", () => {
    render(
      <ImageSuggestBubble suggest={imageSuggest({ loading: true })} translation={translation} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Broadcast.image.loading");
  });

  it("se falhar, diz que não foi possível", () => {
    render(
      <ImageSuggestBubble
        suggest={imageSuggest({ error: "generate", imageUrl: null })}
        translation={translation}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Broadcast.image.failed");
  });

  it("mostra a imagem com Usar, Refazer e Descartar", () => {
    const suggest = imageSuggest();
    render(<ImageSuggestBubble suggest={suggest} translation={translation} />);

    const image = screen.getByRole("img", { name: "equipa a celebrar" });
    expect(image.getAttribute("src")).toBe("data:image/jpeg;base64,QUJD");

    fireEvent.click(screen.getByRole("button", { name: "Broadcast.image.use" }));
    fireEvent.click(screen.getByRole("button", { name: "Broadcast.image.again" }));
    fireEvent.click(screen.getByRole("button", { name: "Broadcast.image.discard" }));

    expect(suggest.accept).toHaveBeenCalled();
    expect(suggest.ask).toHaveBeenCalled();
    expect(suggest.discardImage).toHaveBeenCalled();
  });

  it("a juntar à mensagem, os botões ficam parados", () => {
    render(
      <ImageSuggestBubble suggest={imageSuggest({ saving: true })} translation={translation} />,
    );

    expect(screen.getByRole("button", { name: "Broadcast.image.saving" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Broadcast.image.again" })).toBeDisabled();
  });

  it("se não conseguir juntar, avisa e deixa a imagem", () => {
    render(
      <ImageSuggestBubble suggest={imageSuggest({ error: "save" })} translation={translation} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Broadcast.image.saveFailed");
    expect(screen.getByRole("img")).toBeInTheDocument();
  });
});
