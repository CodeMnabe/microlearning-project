import React, { useRef, useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import VariableTextEditor, {
  serializeEditor,
} from "@/app/[locale]/(app)/templates/components/VariableTextEditor";

const labelFor = (kind) => `label:${kind}`;

function chip(index, kind = "custom", example = "") {
  const span = document.createElement("span");
  span.setAttribute("data-var", "");
  span.setAttribute("data-index", String(index));
  span.setAttribute("data-kind", kind);
  span.setAttribute("data-example", example);
  span.textContent = "chip";
  return span;
}

describe("serializeEditor", () => {
  it("turns chips into sequential placeholders in order of appearance", () => {
    const root = document.createElement("div");
    root.append("Olá ", chip(1, "contact_name"), ", dica ", chip(0), "!");

    expect(serializeEditor(root)).toEqual({
      text: "Olá {{1}}, dica {{2}}!",
      chips: [
        { index: 1, kind: "contact_name", example: "" },
        { index: 0, kind: "custom", example: "" },
      ],
    });
  });

  it("maps browser line structure to newlines", () => {
    const root = document.createElement("div");
    root.append("linha 1");
    const div1 = document.createElement("div");
    div1.append("linha 2");
    const div2 = document.createElement("div");
    div2.append(document.createElement("br")); // empty line placeholder
    const div3 = document.createElement("div");
    div3.append("linha 4");
    root.append(div1, div2, div3);

    expect(serializeEditor(root).text).toBe("linha 1\nlinha 2\n\nlinha 4");
  });
});

function Harness({ initial, onChange }) {
  const ref = useRef(null);
  const [state, setState] = useState(initial);
  return (
    <>
      <VariableTextEditor
        ref={ref}
        ariaLabel="body"
        value={state.text}
        kinds={state.kinds}
        examples={state.examples}
        labelFor={labelFor}
        onChange={(next) => {
          setState(next);
          onChange?.(next);
        }}
      />
      <button
        type="button"
        onClick={() => ref.current.insertVariable("company", "Digik")}
      >
        insert
      </button>
    </>
  );
}

describe("VariableTextEditor", () => {
  it("renders placeholders as labelled chips", () => {
    render(
      <Harness
        initial={{
          text: "Olá {{1}}!",
          kinds: ["contact_name"],
          examples: ["João"],
        }}
      />,
    );

    const editor = screen.getByLabelText("body");
    expect(editor.textContent).toBe("Olá label:contact_name!");
    const chipEl = editor.querySelector("[data-var]");
    expect(chipEl.getAttribute("data-example")).toBe("João");
  });

  it("appends a chip at the end when there is no caret inside", () => {
    const onChange = vi.fn();
    render(
      <Harness
        initial={{ text: "Olá", kinds: [], examples: [] }}
        onChange={onChange}
      />,
    );

    act(() => {
      fireEvent.click(screen.getByText("insert"));
    });

    expect(onChange).toHaveBeenLastCalledWith({
      text: "Olá{{1}} ",
      kinds: ["company"],
      examples: ["Digik"],
    });
  });

  it("re-emits renumbered text after the user edits the DOM", () => {
    const onChange = vi.fn();
    render(
      <Harness
        initial={{
          text: "A {{1}} B {{2}}",
          kinds: ["contact_name", "custom"],
          examples: ["João", "x"],
        }}
        onChange={onChange}
      />,
    );

    const editor = screen.getByLabelText("body");
    // Simulate the user deleting the first chip with backspace.
    editor.querySelector("[data-var]").remove();
    fireEvent.input(editor);

    expect(onChange).toHaveBeenLastCalledWith({
      text: "A  B {{1}}",
      kinds: ["custom"],
      examples: ["x"],
    });
  });
});
