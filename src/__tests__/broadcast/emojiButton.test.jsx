import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/* O seletor verdadeiro é pesado: aqui fica uma versão mínima. */
vi.mock("emoji-picker-react", () => ({
  default: ({ onEmojiClick, searchPlaceholder, categories, emojiData }) => (
    <div data-testid="picker" data-emoji-data={emojiData ? "pt" : "default"}>
      <span>{searchPlaceholder}</span>
      <span>{categories.map((c) => c.name).join("|")}</span>
      <button type="button" onClick={() => onEmojiClick({ emoji: "😀" })}>
        escolher
      </button>
    </div>
  ),
}));

vi.mock("emoji-picker-react/dist/data/emojis-pt.json", () => ({
  default: { locale: "pt" },
}));

import EmojiButton from "@/app/[locale]/(app)/broadcast/components/EmojiButton";

const translation = (key) => key;

function renderButton() {
  const editor = { insertText: vi.fn() };
  render(
    <EmojiButton editorRef={{ current: editor }} translation={translation} />,
  );
  return editor;
}

function openPicker() {
  fireEvent.click(screen.getByRole("button", { name: "Broadcast.emoji.open" }));
}

describe("EmojiButton", () => {
  it("abre o seletor com os emojis e os textos em português", async () => {
    renderButton();
    openPicker();

    const picker = await screen.findByTestId("picker");
    expect(picker).toHaveAttribute("data-emoji-data", "pt");
    expect(screen.getByText("Broadcast.emoji.search")).toBeInTheDocument();
    expect(
      screen.getByText(/Broadcast\.emoji\.categories\.smileys_people/),
    ).toBeInTheDocument();
  });

  it("não mostra as bandeiras, que o Windows desenha como letras", async () => {
    renderButton();
    openPicker();
    await screen.findByTestId("picker");

    expect(
      screen.queryByText(/Broadcast\.emoji\.categories\.flags/),
    ).not.toBeInTheDocument();
  });

  it("escolher um emoji põe-no no balão e fecha o seletor", async () => {
    const editor = renderButton();
    openPicker();

    fireEvent.click(await screen.findByRole("button", { name: "escolher" }));

    expect(editor.insertText).toHaveBeenCalledWith("😀");
    await waitFor(() =>
      expect(screen.queryByTestId("picker")).not.toBeInTheDocument(),
    );
  });

  it("o Escape fecha o seletor", async () => {
    renderButton();
    openPicker();
    await screen.findByTestId("picker");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByTestId("picker")).not.toBeInTheDocument(),
    );
  });

  it("não tira o cursor do balão ao carregar no botão", () => {
    renderButton();

    expect(
      fireEvent.mouseDown(
        screen.getByRole("button", { name: "Broadcast.emoji.open" }),
      ),
    ).toBe(false);
  });
});
