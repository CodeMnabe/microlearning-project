"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import styles from "../broadcast.module.css";

const TOKEN_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;

/**
 * Lê o DOM do editor de volta para texto. As pastilhas voltam a ser o token
 * que representam ({{nome}}, {{link.curso}}, ...).
 */
export function serializeEditor(root) {
  let text = "";

  const walk = (node) => {
    const children = Array.from(node.childNodes);

    children.forEach((child, i) => {
      if (child.nodeType === 3) {
        text += child.nodeValue;
        return;
      }

      if (child.nodeType !== 1) return;

      if (child.hasAttribute("data-token")) {
        text += child.getAttribute("data-token");
        return;
      }

      const tag = child.tagName;

      if (tag === "BR") {
        // Um <br> final dentro de um bloco é o placeholder do browser para
        // uma linha vazia, não uma quebra real.
        const isLast = i === children.length - 1;
        if (!(isLast && node !== root)) text += "\n";
        return;
      }

      if (tag === "DIV" || tag === "P") {
        // Os browsers embrulham cada linha depois da primeira num bloco.
        if (text) text += "\n";
        walk(child);
        return;
      }

      walk(child);
    });
  };

  walk(root);
  return text;
}

function makeChip(doc, { token, label }) {
  const span = doc.createElement("span");
  span.className = styles.tokenChip;
  span.setAttribute("data-token", token);
  span.setAttribute("contenteditable", "false");
  span.textContent = label;
  return span;
}

function renderInto(root, text, tokenLabel) {
  root.textContent = "";
  const doc = root.ownerDocument;
  const value = String(text || "");
  let last = 0;

  for (const m of value.matchAll(TOKEN_RE)) {
    const label = tokenLabel(m[1]);

    if (!label) continue;

    if (m.index > last) {
      root.appendChild(doc.createTextNode(value.slice(last, m.index)));
    }

    root.appendChild(makeChip(doc, { token: `{{${m[1]}}}`, label }));
    last = m.index + m[0].length;
  }

  if (last < value.length) {
    root.appendChild(doc.createTextNode(value.slice(last)));
  }
}

function syncLabels(root, tokenLabel) {
  root.querySelectorAll("[data-token]").forEach((chip) => {
    const key = chip.getAttribute("data-token").slice(2, -2);
    const label = tokenLabel(key) || chip.getAttribute("data-token");
    if (chip.textContent !== label) chip.textContent = label;
  });
}

/**
 * Campo de texto onde os tokens conhecidos ({{nome}}, {{empresa}},
 * {{link.chave}}) aparecem como pastilhas. O pai é dono do estado: `value`
 * é o texto com os tokens; `tokenLabel(key)` devolve o rótulo da pastilha
 * ou null para deixar o token como texto normal.
 */
const TokenTextEditor = forwardRef(function TokenTextEditor(
  {
    value,
    tokenLabel,
    placeholder,
    disabled = false,
    onChange,
    ariaLabel,
    className = "",
  },
  ref,
) {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (serializeEditor(root) !== String(value || "")) {
      renderInto(root, value, tokenLabel);
    } else {
      syncLabels(root, tokenLabel);
    }
  }, [value, tokenLabel]);

  const emit = () => {
    const root = rootRef.current;
    if (!root) return;
    onChange(serializeEditor(root));
  };

  const insertToken = (key) => {
    const root = rootRef.current;
    if (!root || disabled) return;

    const doc = root.ownerDocument;
    const win = doc.defaultView;
    const token = `{{${key}}}`;
    const label = tokenLabel(key) || token;
    const chip = makeChip(doc, { token, label });

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

    const space = doc.createTextNode(" ");
    chip.after(space);
    range.setStartAfter(space);
    range.collapse(true);

    root.focus();

    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    emit();
  };

  /* Troca o texto todo (sugestão da IA) e avisa o pai, que é dono do estado. */
  const setText = (text) => {
    const root = rootRef.current;
    if (!root || disabled) return;

    renderInto(root, text, tokenLabel);
    emit();
  };

  useImperativeHandle(ref, () => ({
    insertToken,
    getText: () => (rootRef.current ? serializeEditor(rootRef.current) : ""),
    setText,
    focus: () => rootRef.current?.focus(),
  }));

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain") || "";
    const doc = rootRef.current?.ownerDocument;
    if (doc?.execCommand) doc.execCommand("insertText", false, text);
    emit();
  };

  return (
    <div
      ref={rootRef}
      role="textbox"
      aria-multiline="true"
      aria-label={ariaLabel}
      className={`${styles.tokenEditor} ${className}`}
      contentEditable={!disabled}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={emit}
      onPaste={handlePaste}
    />
  );
});

export default TokenTextEditor;
