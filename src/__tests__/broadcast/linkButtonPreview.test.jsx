import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LinkButtonPreview, {
  LinkBubblesPreview,
  LinksInTextNote,
} from "@/app/[locale]/(app)/broadcast/components/LinkButtonPreview";

const translation = (key) => key;

describe("LinkButtonPreview", () => {
  it("mostra o botão com o nome do link e tira-o no x", () => {
    const onRemove = vi.fn();

    render(
      <LinkButtonPreview
        linkButton={{ id: "l1", buttonText: "Guia passo a passo" }}
        onRemove={onRemove}
        translation={translation}
      />,
    );

    expect(screen.getByText("Guia passo a passo")).toBeTruthy();
    expect(screen.getByText("Broadcast.composer.linkButtonHint")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Broadcast.composer.linkButtonRemove",
      }),
    );
    expect(onRemove).toHaveBeenCalledWith("l1");
  });

  it("sem id não mostra o x (link que veio do texto)", () => {
    render(
      <LinkButtonPreview
        linkButton={{ id: null, buttonText: "Guia" }}
        onRemove={vi.fn()}
        translation={translation}
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: "Broadcast.composer.linkButtonRemove",
      }),
    ).toBeNull();
  });

  it("não mostra nada sem link de botão", () => {
    const { container } = render(
      <LinkButtonPreview linkButton={null} translation={translation} />,
    );

    expect(container.textContent).toBe("");
  });
});

describe("LinkBubblesPreview", () => {
  it("mostra um balão com texto e botão por cada link extra", () => {
    const onRemove = vi.fn();

    render(
      <LinkBubblesPreview
        bubbles={[
          { id: "l2", buttonText: "Curso", text: "Já viste o curso?" },
          { id: "l3", buttonText: "Guia", text: "Guia" },
        ]}
        onRemove={onRemove}
        translation={translation}
      />,
    );

    const bubbles = screen.getAllByTestId("link-bubble-preview");
    expect(bubbles).toHaveLength(2);
    expect(bubbles[0]).toHaveTextContent("Já viste o curso?");
    expect(bubbles[0]).toHaveTextContent("Curso");

    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Broadcast.composer.linkButtonRemove",
      })[1],
    );
    expect(onRemove).toHaveBeenCalledWith("l3");
  });
});

describe("LinksInTextNote", () => {
  it("avisa que os links vão no fim do texto", () => {
    render(<LinksInTextNote labels={["Guia"]} translation={translation} />);

    expect(
      screen.getByText("Broadcast.composer.linkButtonInText"),
    ).toBeTruthy();
  });

  it("não mostra nada sem links", () => {
    const { container } = render(
      <LinksInTextNote labels={[]} translation={translation} />,
    );

    expect(container.textContent).toBe("");
  });
});
