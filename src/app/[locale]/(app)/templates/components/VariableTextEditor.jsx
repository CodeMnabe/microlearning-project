"use client";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import styles from "../templates.module.css";

const VARIABLE_RE = /\{\{\s*(\d+)\s*\}\}/g;

/**
 * Reads the editor DOM back into template text. Chips become {{n}} numbered by
 * their order of appearance, so deleting or moving a chip never leaves gaps.
 * Returns the chips in order with the index they had before this edit
 * (-1 for a chip inserted since the last render).
 */
export function serializeEditor(root) {
  let text = "";
  const chips = [];

  const walk = (node) => {
    const children = Array.from(node.childNodes);
    children.forEach((child, i) => {
      if (child.nodeType === 3) {
        text += child.nodeValue;
        return;
      }
      if (child.nodeType !== 1) return;

      if (child.hasAttribute("data-var")) {
        chips.push({
          index: Number(child.getAttribute("data-index") ?? -1),
          kind: child.getAttribute("data-kind") || "custom",
          example: child.getAttribute("data-example") || "",
        });
        text += `{{${chips.length}}}`;
        return;
      }

      const tag = child.tagName;
      if (tag === "BR") {
        // A trailing <br> inside a block is the browser's placeholder for an
        // empty line, not a real line break.
        const isLast = i === children.length - 1;
        if (!(isLast && node !== root)) text += "\n";
        return;
      }
      if (tag === "DIV" || tag === "P") {
        // Browsers wrap each line after the first in a block element.
        if (text) text += "\n";
        walk(child);
        return;
      }
      walk(child);
    });
  };

  walk(root);
  return { text, chips };
}

function makeChip(doc, { index, kind, example, label }) {
  const span = doc.createElement("span");
  span.className = styles.varChip;
  span.setAttribute("data-var", "");
  span.setAttribute("data-index", String(index));
  span.setAttribute("data-kind", kind);
  span.setAttribute("data-example", example || "");
  span.setAttribute("contenteditable", "false");
  span.textContent = label;
  return span;
}

function renderInto(root, text, kinds, examples, labelFor) {
  root.textContent = "";
  const doc = root.ownerDocument;
  let last = 0;
  for (const m of String(text || "").matchAll(VARIABLE_RE)) {
    if (m.index > last) {
      root.appendChild(doc.createTextNode(text.slice(last, m.index)));
    }
    const index = Number(m[1]) - 1;
    const kind = kinds[index] || "custom";
    root.appendChild(
      makeChip(doc, {
        index,
        kind,
        example: examples[index] || "",
        label: labelFor(kind),
      }),
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    root.appendChild(doc.createTextNode(text.slice(last)));
  }
}

function syncChips(root, kinds, examples, labelFor) {
  const chips = root.querySelectorAll("[data-var]");
  chips.forEach((chip, i) => {
    const kind = kinds[i] || "custom";
    chip.setAttribute("data-index", String(i));
    chip.setAttribute("data-kind", kind);
    chip.setAttribute("data-example", examples[i] || "");
    const label = labelFor(kind);
    if (chip.textContent !== label) chip.textContent = label;
  });
}

/**
 * Body text editor where variables are shown as labelled chips instead of
 * {{1}} placeholders. The parent owns the state: `value` is the template text
 * with positional placeholders, plus the parallel `kinds` / `examples` arrays.
 */
const VariableTextEditor = forwardRef(function VariableTextEditor(
  {
    value,
    kinds = [],
    examples = [],
    labelFor,
    placeholder,
    disabled = false,
    onChange,
    onChipClick,
    ariaLabel,
  },
  ref,
) {
  const rootRef = useRef(null);

  // Keep the DOM in step with props without disturbing the caret when the
  // text already matches (which is the case right after the user typed).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const current = serializeEditor(root).text;
    if (current !== String(value || "")) {
      renderInto(root, value, kinds, examples, labelFor);
    } else {
      syncChips(root, kinds, examples, labelFor);
    }
  }, [value, kinds, examples, labelFor]);

  const emit = () => {
    const root = rootRef.current;
    if (!root) return;
    const { text, chips } = serializeEditor(root);
    const nextKinds = chips.map((c) => c.kind);
    const nextExamples = chips.map((c) =>
      c.index >= 0 ? (examples[c.index] ?? c.example) : c.example,
    );
    onChange({ text, kinds: nextKinds, examples: nextExamples });
  };

  const insertVariable = (kind, example) => {
    const root = rootRef.current;
    if (!root || disabled) return;
    const doc = root.ownerDocument;
    const win = doc.defaultView;
    const chip = makeChip(doc, {
      index: -1,
      kind,
      example,
      label: labelFor(kind),
    });

    const selection = win.getSelection?.();
    let range = null;
    if (selection && selection.rangeCount > 0) {
      const candidate = selection.getRangeAt(0);
      if (root.contains(candidate.commonAncestorContainer)) range = candidate;
    }
    if (!range) {
      range = doc.createRange();
      range.selectNodeContents(root);
      range.collapse(false);
    }

    range.deleteContents();
    range.insertNode(chip);
    // Leave a space after the chip so the user can keep typing naturally.
    const space = doc.createTextNode(" ");
    chip.after(space);
    range.setStartAfter(space);
    range.collapse(true);
    // Focus first: some engines reset the selection when focus moves.
    root.focus();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    emit();
    return Array.from(root.querySelectorAll("[data-var]")).indexOf(chip);
  };

  useImperativeHandle(ref, () => ({ insertVariable }));

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain") || "";
    const doc = rootRef.current?.ownerDocument;
    if (doc?.execCommand) doc.execCommand("insertText", false, text);
    emit();
  };

  const handleClick = (e) => {
    const chip = e.target.closest?.("[data-var]");
    if (!chip || !onChipClick) return;
    const chips = Array.from(rootRef.current.querySelectorAll("[data-var]"));
    onChipClick(chips.indexOf(chip));
  };

  return (
    <div
      ref={rootRef}
      role="textbox"
      aria-multiline="true"
      aria-label={ariaLabel}
      className={styles.varEditor}
      contentEditable={!disabled}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={emit}
      onPaste={handlePaste}
      onClick={handleClick}
    />
  );
});

export default VariableTextEditor;
