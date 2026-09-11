import React, { createRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TokenTextEditor, {
  serializeEditor,
} from "@/app/[locale]/(app)/broadcast/components/TokenTextEditor";

function tokenLabel(key) {
  const k = key.toLowerCase();
  if (k === "nome") return "Nome";
  if (k === "empresa") return "Empresa";
  if (k.startsWith("link.")) return `Link: ${k.slice(5)}`;
  return null;
}

describe("TokenTextEditor", () => {
  it("renders known tokens as chips and keeps unknown tokens as text", () => {
    render(
      <TokenTextEditor
        value="Olá {{nome}}, vê {{link.curso}} e {{outro}}"
        tokenLabel={tokenLabel}
        onChange={() => {}}
        ariaLabel="Mensagem"
      />,
    );

    const editor = screen.getByRole("textbox", { name: "Mensagem" });
    const chips = editor.querySelectorAll("[data-token]");

    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveTextContent("Nome");
    expect(chips[0].getAttribute("data-token")).toBe("{{nome}}");
    expect(chips[1]).toHaveTextContent("Link: curso");
    expect(editor.textContent).toBe("Olá Nome, vê Link: curso e {{outro}}");
    expect(serializeEditor(editor)).toBe(
      "Olá {{nome}}, vê {{link.curso}} e {{outro}}",
    );
  });

  it("emits the text with tokens when the user types", () => {
    const onChange = vi.fn();

    render(
      <TokenTextEditor
        value="Olá {{nome}}"
        tokenLabel={tokenLabel}
        onChange={onChange}
        ariaLabel="Mensagem"
      />,
    );

    const editor = screen.getByRole("textbox", { name: "Mensagem" });
    editor.appendChild(document.createTextNode(", tudo bem?"));
    fireEvent.input(editor);

    expect(onChange).toHaveBeenCalledWith("Olá {{nome}}, tudo bem?");
  });

  it("inserts a chip through the ref and reports the new text", () => {
    const onChange = vi.fn();
    const ref = createRef();

    render(
      <TokenTextEditor
        ref={ref}
        value="Bem-vindo à "
        tokenLabel={tokenLabel}
        onChange={onChange}
        ariaLabel="Mensagem"
      />,
    );

    ref.current.insertToken("empresa");

    expect(onChange).toHaveBeenCalledWith("Bem-vindo à {{empresa}} ");

    const editor = screen.getByRole("textbox", { name: "Mensagem" });
    expect(editor.querySelector("[data-token]")).toHaveTextContent("Empresa");
  });

  it("re-renders chips when the value changes from outside", () => {
    const { rerender } = render(
      <TokenTextEditor
        value="A"
        tokenLabel={tokenLabel}
        onChange={() => {}}
        ariaLabel="Mensagem"
      />,
    );

    rerender(
      <TokenTextEditor
        value="B {{nome}}"
        tokenLabel={tokenLabel}
        onChange={() => {}}
        ariaLabel="Mensagem"
      />,
    );

    const editor = screen.getByRole("textbox", { name: "Mensagem" });
    expect(editor.textContent).toBe("B Nome");
  });
});
