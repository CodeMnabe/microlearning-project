"use client";

import { useCallback, useEffect, useState } from "react";
import { Bold, Code, Italic, Strikethrough, TextQuote } from "lucide-react";

import ListMenu from "./ListMenu";
import styles from "../broadcast.module.css";

/* Formatação de palavras: o WhatsApp usa *, _, ~ e ``` à volta do texto. */
const TEXT_FORMATS = [
  { type: "bold", label: "Broadcast.format.bold", Icon: Bold },
  { type: "italic", label: "Broadcast.format.italic", Icon: Italic },
  { type: "strike", label: "Broadcast.format.strike", Icon: Strikethrough },
  { type: "mono", label: "Broadcast.format.mono", Icon: Code },
];

/*
 * Os botões não tiram o cursor do balão (mousedown sem efeito), para a
 * seleção ainda lá estar quando o clique chega ao editor.
 */
const keepSelection = (e) => e.preventDefault();

/**
 * Barra de formatação do balão, na barra de baixo do telemóvel. Atua no
 * editor através do `editorRef` (toggleFormat e toggleLinePrefix) e liga o
 * botão da formatação que está onde está o cursor (getActiveFormats).
 */
export default function FormatToolbar({ editorRef, translation }) {
  const [active, setActive] = useState({});

  const refresh = useCallback(() => {
    setActive(editorRef?.current?.getActiveFormats?.() || {});
  }, [editorRef]);

  /*
   * O cursor muda ao escrever, ao clicar e com as setas (selectionchange);
   * os atalhos e os botões mudam a formatação sem mexer no cursor, e o
   * editor avisa com formatstatechange.
   */
  useEffect(() => {
    document.addEventListener("selectionchange", refresh);
    document.addEventListener("formatstatechange", refresh);

    return () => {
      document.removeEventListener("selectionchange", refresh);
      document.removeEventListener("formatstatechange", refresh);
    };
  }, [refresh]);

  const renderButton = (key, label, Icon, onClick) => (
    <button
      key={key}
      type="button"
      className={styles.formatBtn}
      aria-label={translation(label)}
      aria-pressed={Boolean(active[key])}
      title={translation(label)}
      onMouseDown={keepSelection}
      onClick={() => {
        onClick();
        refresh();
      }}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );

  return (
    <div
      className={styles.formatToolbar}
      role="toolbar"
      aria-label={translation("Broadcast.format.toolbar")}
    >
      {TEXT_FORMATS.map(({ type, label, Icon }) =>
        renderButton(type, label, Icon, () =>
          editorRef?.current?.toggleFormat?.(type),
        ),
      )}

      <span className={styles.formatDivider} aria-hidden="true" />

      {/* Formatação de linha: prefixos no início de cada linha. */}
      <ListMenu
        active={active}
        translation={translation}
        onPick={(kind) => {
          editorRef?.current?.toggleLinePrefix?.(kind);
          refresh();
        }}
      />

      {renderButton("quote", "Broadcast.format.quote", TextQuote, () =>
        editorRef?.current?.toggleLinePrefix?.("quote"),
      )}
    </div>
  );
}
