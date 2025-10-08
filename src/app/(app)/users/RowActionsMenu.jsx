"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MessageSquare, Pencil, Trash2 } from "lucide-react";

export default function RowActionsMenu({
  anchorEl,
  open,
  onClose,
  onSendMessage,
  onEdit,
  onDelete,
}) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [direction, setDirection] = useState("down"); // "down" | "up"

  // close on outside click / ESC
  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (!ref.current) return;
      if (ref.current.contains(e.target)) return;
      if (anchorEl && anchorEl.contains?.(e.target)) return;
      onClose();
    }
    function onEsc(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, anchorEl, onClose]);

  // positioner (flip when needed)
  useLayoutEffect(() => {
    if (!open || !anchorEl) return;

    function compute() {
      const btn = anchorEl.getBoundingClientRect();
      const gap = 8;

      // current menu size (fallbacks used on first paint)
      const menuRect = ref.current?.getBoundingClientRect();
      const menuW = menuRect?.width ?? 220;
      const menuH = menuRect?.height ?? 200;

      // horizontal: right-align with clamping
      const left = Math.max(
        12,
        Math.min(window.innerWidth - menuW - 12, btn.right - menuW)
      );

      // decide up vs down
      const spaceBelow = window.innerHeight - btn.bottom;
      const spaceAbove = btn.top;
      let top = btn.bottom + gap;
      let dir = "down";

      if (spaceBelow < menuH + gap && spaceAbove > spaceBelow) {
        top = Math.max(12, btn.top - menuH - gap);
        dir = "up";
      } else {
        top = Math.min(window.innerHeight - menuH - 12, btn.bottom + gap);
      }

      setPos({ top, left });
      setDirection(dir);
    }

    // first pass (with guesses), then after paint with real size
    compute();
    const raf = requestAnimationFrame(compute);

    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true); // capture scrolls in parents
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open, anchorEl]);

  if (!open || !anchorEl) return null;

  const style = {
    position: "fixed",
    top: pos.top,
    left: pos.left,
    width: 220,
    background: "#fff",
    border: "1px solid #e5edf5",
    borderRadius: 12,
    boxShadow: "0 12px 32px rgba(0,0,0,.15)",
    zIndex: 9999,
    padding: 6,
    transformOrigin: direction === "up" ? "bottom right" : "top right",
    animation: "menuIn .12s ease-out",
  };

  const item = {
    display: "grid",
    gridTemplateColumns: "24px 1fr",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "10px 10px",
    borderRadius: 10,
    background: "transparent",
    border: 0,
    textAlign: "left",
    cursor: "pointer",
  };

  const iconProps = { size: 18, strokeWidth: 2, "aria-hidden": true };

  return (
    <div ref={ref} style={style} role="menu" aria-label="Ações do utilizador">
      {/* <button style={item} onClick={onSendMessage} role="menuitem">
        <MessageSquare {...iconProps} />
        <span>Enviar Mensagem</span>
      </button> */}
      <button style={item} onClick={onEdit} role="menuitem">
        <Pencil {...iconProps} />
        <span>Editar</span>
      </button>
      <div style={{ height: 1, background: "#eef3f7", margin: "4px 6px" }} />
      <button
        style={{ ...item, color: "#b42318", background: "#fff5f5" }}
        onClick={onDelete}
        role="menuitem"
      >
        <Trash2 {...iconProps} />
        <span>Apagar</span>
      </button>
    </div>
  );
}
