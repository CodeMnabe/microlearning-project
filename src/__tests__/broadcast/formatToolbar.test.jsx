import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FormatToolbar from "@/app/[locale]/(app)/broadcast/components/FormatToolbar";

const translation = (key) => key;

function renderToolbar(activeFormats = {}) {
  const editor = {
    toggleFormat: vi.fn(),
    toggleLinePrefix: vi.fn(),
    getActiveFormats: vi.fn(() => activeFormats),
  };
  render(
    <FormatToolbar editorRef={{ current: editor }} translation={translation} />,
  );
  return editor;
}

const pressed = (name) =>
  screen.getByRole("button", { name }).getAttribute("aria-pressed");

describe("FormatToolbar", () => {
  it.each([
    ["Broadcast.format.bold", "bold"],
    ["Broadcast.format.italic", "italic"],
    ["Broadcast.format.strike", "strike"],
    ["Broadcast.format.mono", "mono"],
  ])("%s formata o texto", (name, type) => {
    const editor = renderToolbar();

    fireEvent.click(screen.getByRole("button", { name }));

    expect(editor.toggleFormat).toHaveBeenCalledWith(type);
  });

  it("a citação é um botão próprio, como no Teams", () => {
    const editor = renderToolbar();

    fireEvent.click(
      screen.getByRole("button", { name: "Broadcast.format.quote" }),
    );

    expect(editor.toggleLinePrefix).toHaveBeenCalledWith("quote");
  });

  describe("menu das listas", () => {
    const openMenu = () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Broadcast.format.lists" }),
      );

    it.each([
      ["Broadcast.format.bullet", "bullet"],
      ["Broadcast.format.numbered", "numbered"],
      ["Broadcast.format.task", "task"],
    ])("%s formata a linha e fecha o menu", (name, kind) => {
      const editor = renderToolbar();

      openMenu();
      fireEvent.click(screen.getByRole("menuitemradio", { name }));

      expect(editor.toggleLinePrefix).toHaveBeenCalledWith(kind);
      expect(screen.queryByRole("menu")).toBeNull();
    });

    it("com o cursor numa lista, liga o botão e marca a lista no menu", () => {
      renderToolbar({ numbered: true });

      act(() => {
        document.dispatchEvent(new Event("selectionchange"));
      });
      openMenu();

      expect(
        screen
          .getByRole("button", { name: "Broadcast.format.lists" })
          .getAttribute("data-active"),
      ).toBe("true");
      expect(
        screen
          .getByRole("menuitemradio", { name: "Broadcast.format.numbered" })
          .getAttribute("aria-checked"),
      ).toBe("true");
      expect(
        screen
          .getByRole("menuitemradio", { name: "Broadcast.format.bullet" })
          .getAttribute("aria-checked"),
      ).toBe("false");
    });

    it("fecha com Escape e ao carregar fora", () => {
      renderToolbar();

      openMenu();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("menu")).toBeNull();

      openMenu();
      fireEvent.mouseDown(document.body);
      expect(screen.queryByRole("menu")).toBeNull();
    });

    it("não tira o cursor do balão ao escolher uma lista", () => {
      renderToolbar();

      openMenu();

      expect(
        fireEvent.mouseDown(
          screen.getByRole("menuitemradio", { name: "Broadcast.format.bullet" }),
        ),
      ).toBe(false);
    });
  });

  it("liga os botões da formatação que está no cursor", () => {
    renderToolbar({ bold: true, italic: false, quote: true });

    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });

    expect(pressed("Broadcast.format.bold")).toBe("true");
    expect(pressed("Broadcast.format.italic")).toBe("false");
    expect(pressed("Broadcast.format.quote")).toBe("true");
  });

  it("volta a ver a formatação depois de carregar num botão", () => {
    const editor = renderToolbar({ bold: true });
    editor.getActiveFormats.mockClear();

    fireEvent.click(
      screen.getByRole("button", { name: "Broadcast.format.bold" }),
    );

    expect(editor.getActiveFormats).toHaveBeenCalled();
    expect(pressed("Broadcast.format.bold")).toBe("true");
  });

  it("ouve o aviso do editor quando a formatação muda (atalhos)", () => {
    const editor = renderToolbar({});
    editor.getActiveFormats.mockReturnValue({ italic: true });

    act(() => {
      document.dispatchEvent(new Event("formatstatechange"));
    });

    expect(pressed("Broadcast.format.italic")).toBe("true");
  });

  it("não tira o cursor do balão ao carregar num botão", () => {
    renderToolbar();

    expect(
      fireEvent.mouseDown(
        screen.getByRole("button", { name: "Broadcast.format.bold" }),
      ),
    ).toBe(false);
  });
});
