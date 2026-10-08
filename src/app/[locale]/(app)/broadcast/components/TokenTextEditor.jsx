"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { parseWhatsappFormat } from "@/lib/whatsapp/textFormat";
import {
  LINE_KINDS,
  breakListLine,
  removeListPrefix,
  toggleLinePrefixInText,
} from "@/lib/whatsapp/lineFormat";
import styles from "../broadcast.module.css";

const TOKEN_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;

/*
 * Carácter invisível que marca onde o cursor escreve quando um botão de
 * formatação é ligado ou desligado sem texto selecionado: sem ele, o browser
 * não tem onde pôr o cursor dentro (ou fora) da formatação. Nunca vai para o
 * texto guardado.
 */
const CARET_MARK = "​";

/* Marcas de formatação no balão e o marcador do WhatsApp de cada uma. */
const INLINE_TAG_MARKERS = {
  STRONG: "*",
  B: "*",
  EM: "_",
  I: "_",
  S: "~",
  STRIKE: "~",
  DEL: "~",
};

const FORMAT_ELEMENTS = { bold: "strong", italic: "em", strike: "s" };

const FORMAT_SELECTOR = "strong, b, em, i, s, strike, del, code";

/*
 * O WhatsApp não aceita espaços junto dos marcadores (`* Olá *`) nem
 * formatação que atravesse linhas: os espaços das pontas ficam fora e cada
 * linha leva os seus marcadores.
 */
function wrapInline(marker, inner) {
  return inner
    .split("\n")
    .map((line) => {
      const core = line.trim();
      if (!core) return line;

      const lead = line.slice(0, line.indexOf(core));
      const trail = line.slice(lead.length + core.length);
      return `${lead}${marker}${core}${marker}${trail}`;
    })
    .join("\n");
}

/**
 * Lê o DOM do editor de volta para texto. As pastilhas voltam a ser o token
 * que representam ({{nome}}, {{link.curso}}, ...) e a formatação volta aos
 * marcadores do WhatsApp (*negrito*, _itálico_, ~riscado~, ```código```).
 */
export function serializeEditor(root) {
  let text = "";

  const walk = (node) => {
    const children = Array.from(node.childNodes);

    children.forEach((child, i) => {
      if (child.nodeType === 3) {
        text += child.nodeValue.split(CARET_MARK).join("");
        return;
      }

      if (child.nodeType !== 1) return;

      if (child.hasAttribute("data-token")) {
        text += child.getAttribute("data-token");
        return;
      }

      const tag = child.tagName;

      if (INLINE_TAG_MARKERS[tag]) {
        const inner = serializeEditor(child);
        if (inner.trim()) text += wrapInline(INLINE_TAG_MARKERS[tag], inner);
        else text += inner;
        return;
      }

      if (tag === "CODE") {
        const inner = serializeEditor(child);
        if (inner) text += "```" + inner + "```";
        return;
      }

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

/* Texto com tokens: os conhecidos viram pastilhas, o resto fica texto. */
function appendTextWithTokens(parent, value, tokenLabel) {
  const doc = parent.ownerDocument;
  let last = 0;

  for (const m of value.matchAll(TOKEN_RE)) {
    const label = tokenLabel(m[1]);

    if (!label) continue;

    if (m.index > last) {
      parent.appendChild(doc.createTextNode(value.slice(last, m.index)));
    }

    parent.appendChild(makeChip(doc, { token: `{{${m[1]}}}`, label }));
    last = m.index + m[0].length;
  }

  if (last < value.length) {
    parent.appendChild(doc.createTextNode(value.slice(last)));
  }
}

function appendFormatted(parent, nodes, tokenLabel) {
  const doc = parent.ownerDocument;

  for (const node of nodes) {
    if (node.type === "text") {
      appendTextWithTokens(parent, node.value, tokenLabel);
      continue;
    }

    if (node.type === "mono") {
      const code = doc.createElement("code");
      appendTextWithTokens(code, node.value, tokenLabel);
      parent.appendChild(code);
      continue;
    }

    const element = doc.createElement(FORMAT_ELEMENTS[node.type]);
    appendFormatted(element, node.children, tokenLabel);
    parent.appendChild(element);
  }
}

/* Desenha o texto no balão: formatação do WhatsApp e pastilhas. */
function renderInto(root, text, tokenLabel) {
  root.textContent = "";
  appendFormatted(
    root,
    parseWhatsappFormat(String(text || "")),
    tokenLabel,
  );
}

/* Marcas de cada formatação: a que o editor cria e as que o browser cria. */
const FORMAT_TAGS = {
  bold: ["STRONG", "B"],
  italic: ["EM", "I"],
  strike: ["S", "STRIKE", "DEL"],
  mono: ["CODE"],
};

const NEW_FORMAT_ELEMENT = { ...FORMAT_ELEMENTS, mono: "code" };

const WORD_CHAR = /[\p{L}\p{N}]/u;
const SPACE = /\s/;

function unwrap(element) {
  element.replaceWith(...element.childNodes);
}

function closestFormat(node, root, tags) {
  for (let current = node; current && current !== root; current = current.parentNode) {
    if (current.nodeType === 1 && tags.includes(current.tagName)) return current;
  }

  return null;
}

/*
 * O WhatsApp só formata palavras inteiras e sem espaços junto dos
 * marcadores: alarga as pontas da seleção até à palavra e deixa os espaços
 * de fora.
 */
function fitRangeToWords(range) {
  const start = range.startContainer;
  const end = range.endContainer;
  const caret = range.collapsed;

  /*
   * Uma ponta só se alarga quando está a meio de uma palavra; com o cursor
   * sozinho (sem seleção), apanha a palavra onde ele está.
   */
  if (start.nodeType === 3) {
    let offset = range.startOffset;
    const inWord = caret || WORD_CHAR.test(start.data[offset] ?? "");

    while (inWord && offset > 0 && WORD_CHAR.test(start.data[offset - 1])) {
      offset -= 1;
    }
    range.setStart(start, offset);
  }

  if (end.nodeType === 3) {
    let offset = range.endOffset;
    const inWord = caret || WORD_CHAR.test(end.data[offset - 1] ?? "");

    while (
      inWord &&
      offset < end.data.length &&
      WORD_CHAR.test(end.data[offset])
    ) {
      offset += 1;
    }
    range.setEnd(end, offset);
  }

  if (start.nodeType === 3) {
    let offset = range.startOffset;
    const limit = start === end ? range.endOffset : start.data.length;
    while (offset < limit && SPACE.test(start.data[offset])) offset += 1;
    range.setStart(start, offset);
  }

  if (end.nodeType === 3) {
    let offset = range.endOffset;
    const limit = start === end ? range.startOffset : 0;
    while (offset > limit && SPACE.test(end.data[offset - 1])) offset -= 1;
    range.setEnd(end, offset);
  }
}

function hasContent(node) {
  return (
    Boolean(node.textContent.split(CARET_MARK).join("")) ||
    Boolean(node.querySelector?.("[data-token]"))
  );
}

function caretAfterMark(doc, mark) {
  const caret = doc.createRange();
  caret.setStart(mark, mark.length);
  caret.collapse(true);
  return caret;
}

/*
 * Liga a formatação no cursor: o que se escrever a seguir entra numa marca
 * nova (com o carácter invisível, para o cursor ter onde ficar).
 */
function enterFormat(doc, tagName, range) {
  const element = doc.createElement(tagName);
  const mark = doc.createTextNode(CARET_MARK);
  element.appendChild(mark);
  range.insertNode(element);
  return caretAfterMark(doc, mark);
}

/*
 * Desliga a formatação no cursor: o cursor passa para fora da marca. A meio
 * de uma palavra, a marca é dividida e o que estava depois do cursor
 * continua formatado.
 */
function leaveFormat(element, range) {
  const doc = element.ownerDocument;
  const after = doc.createRange();
  after.setStart(range.startContainer, range.startOffset);
  after.setEnd(element, element.childNodes.length);
  const rest = after.extractContents();

  const mark = doc.createTextNode(CARET_MARK);
  element.after(mark);

  if (hasContent(rest)) {
    const continuation = element.cloneNode(false);
    continuation.appendChild(rest);
    mark.after(continuation);
  }

  if (!hasContent(element)) element.remove();

  return caretAfterMark(doc, mark);
}

/*
 * O texto guardado de um pedaço do balão. As marcas cortadas a meio fecham
 * no corte: com o cursor a meio de "*olá*", fica "*o*" de um lado e "*lá*"
 * do outro, e cada lado continua certo para o WhatsApp.
 */
function textOfRange(root, setBounds) {
  const doc = root.ownerDocument;
  const range = doc.createRange();
  setBounds(range);

  const holder = doc.createElement("div");
  holder.appendChild(range.cloneContents());
  return serializeEditor(holder);
}

/* O texto antes do início e depois do fim de uma seleção (ou cursor). */
function textAround(root, range) {
  return {
    before: textOfRange(root, (r) => {
      r.setStart(root, 0);
      r.setEnd(range.startContainer, range.startOffset);
    }),
    after: textOfRange(root, (r) => {
      r.setStart(range.endContainer, range.endOffset);
      r.setEnd(root, root.childNodes.length);
    }),
  };
}

/* Em que linha do texto guardado fica um ponto do balão (0 = a primeira). */
function lineIndexAt(root, container, offset) {
  const before = textOfRange(root, (r) => {
    r.setStart(root, 0);
    r.setEnd(container, offset);
  });

  return before.split("\n").length - 1;
}

/*
 * Cursor numa linha e coluna, depois de o balão ser desenhado de novo; sem
 * coluna, vai para o fim da linha. Se o texto acaba numa linha vazia, o
 * browser não a mostra: leva o carácter invisível para o cursor ter onde
 * ficar, senão aparece no fim da linha de cima.
 */
function placeCaret(root, lineIndex, column = Infinity) {
  const doc = root.ownerDocument;
  const range = doc.createRange();
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  let line = 0;
  let col = 0;

  const at = (node, index) => {
    range.setStart(node, index);
    range.collapse(true);

    const emptyLastLine =
      line > 0 &&
      col === 0 &&
      index === node.data.length &&
      !node.nextSibling &&
      node.parentNode === root;

    if (!emptyLastLine) return range;

    const mark = doc.createTextNode(CARET_MARK);
    range.insertNode(mark);
    return caretAfterMark(doc, mark);
  };

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (let index = 0; index <= node.data.length; index += 1) {
      if (line === lineIndex && (col === column || node.data[index] === "\n")) {
        return at(node, index);
      }

      if (index === node.data.length) break;

      if (node.data[index] === "\n") {
        line += 1;
        col = 0;
      } else {
        col += 1;
      }
    }
  }

  range.selectNodeContents(root);
  range.collapse(false);
  return range;
}

function countFormats(nodes) {
  return nodes.reduce(
    (total, node) =>
      node.type === "text"
        ? total
        : total + 1 + (node.children ? countFormats(node.children) : 0),
    0,
  );
}

/*
 * O balão mostra o que o WhatsApp vai mostrar? Compara quanta formatação há
 * no DOM com a que o texto guardado tem de facto. Se não bate certo (por
 * exemplo `*isto*` escrito à mão, ou negrito a meio de uma palavra), é
 * preciso voltar a desenhar.
 */
function needsRedraw(root, text) {
  return (
    root.querySelectorAll(FORMAT_SELECTOR).length !==
    countFormats(parseWhatsappFormat(text))
  );
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
  const lastRangeRef = useRef(null);

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

  /*
   * `labelOverride` serve para um token que ainda não está em `tokenLabel`:
   * um link acabado de juntar só entra na lista no render seguinte.
   */
  const insertToken = (key, labelOverride = null) => {
    const root = rootRef.current;
    if (!root || disabled) return;

    const doc = root.ownerDocument;
    const win = doc.defaultView;
    const token = `{{${key}}}`;
    const label = labelOverride || tokenLabel(key) || token;
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

  /* A seleção atual, se estiver dentro do balão. */
  const selectionRange = () => {
    const root = rootRef.current;
    const selection = root?.ownerDocument.defaultView.getSelection?.();

    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    return root.contains(range.commonAncestorContainer) ? range : null;
  };

  const select = (range) => {
    const selection = rootRef.current.ownerDocument.defaultView.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  };

  /* Avisa a barra de formatação de que o que está ligado pode ter mudado. */
  const notifyFormatChange = () => {
    rootRef.current?.dispatchEvent(
      new CustomEvent("formatstatechange", { bubbles: true }),
    );
  };

  /*
   * Negrito, itálico, riscado ou monoespaçado, como no Teams:
   * - sem seleção, é um interruptor para o que se escreve a seguir;
   * - com seleção, formata as palavras selecionadas (inteiras) ou, se já
   *   estiverem formatadas, tira a formatação.
   */
  const toggleFormat = (type) => {
    const root = rootRef.current;
    const range = selectionRange();
    const tags = FORMAT_TAGS[type];
    if (!root || disabled || !range || !tags) return;

    const doc = root.ownerDocument;
    const existing = closestFormat(range.commonAncestorContainer, root, tags);

    if (range.collapsed) {
      select(
        existing
          ? leaveFormat(existing, range)
          : enterFormat(doc, NEW_FORMAT_ELEMENT[type], range),
      );
      emit();
      notifyFormatChange();
      return;
    }

    if (existing) {
      unwrap(existing);
      emit();
      notifyFormatChange();
      return;
    }

    fitRangeToWords(range);
    if (range.collapsed) return;

    const element = root.ownerDocument.createElement(NEW_FORMAT_ELEMENT[type]);
    const contents = range.extractContents();

    /* A mesma formatação lá dentro ficaria com o marcador repetido. */
    contents.querySelectorAll(tags.join(",")).forEach(unwrap);

    element.appendChild(contents);
    range.insertNode(element);

    const formatted = root.ownerDocument.createRange();
    formatted.selectNodeContents(element);
    select(formatted);

    emit();
    notifyFormatChange();
  };

  /*
   * Que formatação há onde está o cursor, para a barra ligar os botões:
   * negrito, itálico, riscado e monoespaçado pela marca à volta do cursor;
   * lista e citação pelo início da linha.
   */
  const getActiveFormats = () => {
    const active = {
      bold: false,
      italic: false,
      strike: false,
      mono: false,
      bullet: false,
      numbered: false,
      task: false,
      quote: false,
    };

    const root = rootRef.current;
    const range = selectionRange();
    if (!root || !range) return active;

    for (const [type, tags] of Object.entries(FORMAT_TAGS)) {
      active[type] = Boolean(closestFormat(range.startContainer, root, tags));
    }

    const lines = serializeEditor(root).split("\n");
    const line =
      lines[lineIndexAt(root, range.startContainer, range.startOffset)] || "";

    for (const [kind, rule] of Object.entries(LINE_KINDS)) {
      active[kind] = rule.test.test(line);
    }

    return active;
  };

  /* Uma das listas ou a citação nas linhas da seleção. */
  const toggleLinePrefix = (kind) => {
    const root = rootRef.current;
    if (!root || disabled || !LINE_KINDS[kind]) return;

    const range = selectionRange();
    const text = serializeEditor(root);
    const lastIndex = text.split("\n").length - 1;

    const firstLine = range
      ? lineIndexAt(root, range.startContainer, range.startOffset)
      : lastIndex;
    const lastLine = range
      ? lineIndexAt(root, range.endContainer, range.endOffset)
      : lastIndex;

    renderInto(
      root,
      toggleLinePrefixInText(text, kind, firstLine, lastLine),
      tokenLabel,
    );

    root.focus();
    select(placeCaret(root, lastLine));
    emit();
    notifyFormatChange();
  };

  /*
   * Enter e Backspace numa lista (`change` é breakListLine ou
   * removeListPrefix): o texto muda à volta do cursor e o balão é desenhado
   * de novo, com o cursor onde o texto diz. Fora de uma lista devolve false
   * e a tecla faz o normal. Dentro de monoespaçado não mexe: aí o Enter é
   * uma linha do bloco de código.
   */
  const editListLine = (change) => {
    const root = rootRef.current;
    const range = selectionRange();
    if (!root || disabled || !range) return false;
    if (closestFormat(range.startContainer, root, FORMAT_TAGS.mono)) return false;

    const { before, after } = textAround(root, range);
    const next = change(before, after);
    if (!next) return false;

    renderInto(root, next.text, tokenLabel);
    select(placeCaret(root, next.line, next.column));
    emit();
    notifyFormatChange();
    return true;
  };

  /*
   * Teclas:
   * - Enter numa lista continua a lista (ou sai dela, num item vazio); o
   *   Shift+Enter muda de linha sem item novo;
   * - Backspace logo a seguir ao prefixo tira a linha da lista;
   * - Ctrl+B e Ctrl+I seguem as regras do WhatsApp. O Ctrl+U fica
   *   bloqueado porque o WhatsApp não tem sublinhado.
   */
  const handleKeyDown = (e) => {
    if (e.nativeEvent?.isComposing) return;

    const plain = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;

    if (plain && e.key === "Enter") {
      if (editListLine(breakListLine)) e.preventDefault();
      return;
    }

    if (plain && e.key === "Backspace") {
      if (selectionRange()?.collapsed && editListLine(removeListPrefix)) {
        e.preventDefault();
      }
      return;
    }

    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;

    const key = e.key.toLowerCase();

    if (key === "b" || key === "i") {
      e.preventDefault();
      toggleFormat(key === "b" ? "bold" : "italic");
    } else if (key === "u") {
      e.preventDefault();
    }
  };

  useImperativeHandle(ref, () => ({
    insertToken,
    getText: () => (rootRef.current ? serializeEditor(rootRef.current) : ""),
    setText,
    toggleFormat,
    toggleLinePrefix,
    insertText,
    getActiveFormats,
    focus: () => rootRef.current?.focus(),
  }));

  /*
   * Ao sair do balão, mostra a formatação como o WhatsApp a vai mostrar.
   * Só volta a desenhar quando há diferença: desenhar de novo perde a
   * posição do cursor, que o "+" usa para inserir variáveis.
   *
   * Guarda também onde estava o cursor: a pesquisa do seletor de emojis
   * tira o cursor do balão, e o emoji tem de entrar onde ele estava.
   */
  const handleBlur = () => {
    const root = rootRef.current;
    if (!root) return;

    lastRangeRef.current = selectionRange()?.cloneRange() || null;

    const text = serializeEditor(root);

    if (needsRedraw(root, text)) {
      renderInto(root, text, tokenLabel);
      lastRangeRef.current = null;
    }
  };

  /*
   * Põe texto (um emoji) onde está o cursor; se o cursor já saiu do balão,
   * onde estava quando saiu; sem nenhum dos dois, no fim.
   */
  const insertText = (value) => {
    const root = rootRef.current;
    if (!root || disabled || !value) return;

    const doc = root.ownerDocument;
    const remembered = lastRangeRef.current;

    let range = selectionRange();

    if (!range && remembered && root.contains(remembered.startContainer)) {
      range = remembered;
    }

    if (!range) {
      range = doc.createRange();
      range.selectNodeContents(root);
      range.collapse(false);
    }

    const node = doc.createTextNode(value);
    range.deleteContents();
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);

    root.focus();
    select(range);
    lastRangeRef.current = range.cloneRange();

    emit();
  };

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
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
    />
  );
});

export default TokenTextEditor;
