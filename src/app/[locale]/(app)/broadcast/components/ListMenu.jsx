"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, List, ListOrdered, SquareCheck } from "lucide-react";

import styles from "../broadcast.module.css";

/* As listas do menu, pela ordem do Teams. */
const LISTS = [
  { kind: "bullet", label: "Broadcast.format.bullet", Icon: List },
  { kind: "numbered", label: "Broadcast.format.numbered", Icon: ListOrdered },
  { kind: "task", label: "Broadcast.format.task", Icon: SquareCheck },
];

/* Não tira o cursor do balão ao carregar no botão ou num item. */
const keepSelection = (e) => e.preventDefault();

/**
 * Botão "Listas" da barra de formatação, como no Teams: abre um menu com
 * as três listas. O botão fica ligado quando o cursor está numa lista, e no
 * menu fica marcada a lista dessa linha. Escolher a lista que já lá está
 * tira-a (é o mesmo interruptor dos outros botões).
 */
export default function ListMenu({ active, onPick, translation }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const itemRefs = useRef([]);
  const openedByKeyboard = useRef(false);

  const inList = LISTS.some(({ kind }) => active[kind]);

  useEffect(() => {
    if (!open) return undefined;

    /* Aberto pelo teclado (Enter ou espaço no botão), o foco vai para o menu. */
    if (openedByKeyboard.current) itemRefs.current[0]?.focus();

    function onDocumentMouseDown(e) {
      if (wrapRef.current?.contains(e.target)) return;
      setOpen(false);
    }

    /* Com o foco no menu, o Escape devolve-o ao botão para não se perder. */
    function onKeyDown(e) {
      if (e.key !== "Escape") return;

      if (wrapRef.current?.contains(document.activeElement)) {
        buttonRef.current?.focus();
      }
      setOpen(false);
    }

    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /* Setas para cima e para baixo andam pelos itens, em volta. */
  const moveFocus = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

    e.preventDefault();
    const items = itemRefs.current.filter(Boolean);
    const current = items.indexOf(e.target);
    const step = e.key === "ArrowDown" ? 1 : -1;
    items[(current + step + items.length) % items.length]?.focus();
  };

  return (
    <div className={styles.listMenuWrap} ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.formatBtn} ${styles.listMenuBtn}`}
        aria-label={translation("Broadcast.format.lists")}
        title={translation("Broadcast.format.lists")}
        aria-haspopup="menu"
        aria-expanded={open}
        data-active={inList}
        onMouseDown={keepSelection}
        onClick={(e) => {
          openedByKeyboard.current = e.detail === 0;
          setOpen((value) => !value);
        }}
      >
        <List size={16} aria-hidden="true" />
        <ChevronDown size={12} aria-hidden="true" />
      </button>

      {open && (
        <div
          className={styles.listMenu}
          role="menu"
          aria-label={translation("Broadcast.format.lists")}
          onKeyDown={moveFocus}
        >
          {LISTS.map(({ kind, label, Icon }, index) => (
            <button
              key={kind}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={Boolean(active[kind])}
              className={styles.listMenuItem}
              onMouseDown={keepSelection}
              onClick={() => {
                onPick(kind);
                setOpen(false);
              }}
            >
              <Icon size={16} aria-hidden="true" />
              {translation(label)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
