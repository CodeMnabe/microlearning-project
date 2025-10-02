"use client";
import { useEffect, useState } from "react";
import styles from "./quickActions.module.css";

export default function QuickActionsModal({
  anchorEl,
  open,
  onClose,
  onChoose,
}) {
  if (!open || !anchorEl) return null;

  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Position next to the + button
  useEffect(() => {
    function place() {
      if (!anchorEl) return;
      const r = anchorEl.getBoundingClientRect();
      setPos({ top: r.bottom + 8, left: r.left - 6 }); // nudge left a bit
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorEl, open]);

  // Close on ESC / click outside
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    function onDocClick(e) {
      if (!open) return;
      const el = document.getElementById("qa-popover");
      if (!el) return;
      if (!el.contains(e.target) && anchorEl && !anchorEl.contains(e.target))
        onClose?.();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDocClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [open, anchorEl, onClose]);

  if (!open || !anchorEl) return null;

  return (
    <div className={styles.wrap} style={{ top: pos.top, left: pos.left }}>
      <div
        className={styles.pop}
        id="qa-popover"
        role="menu"
        aria-orientation="vertical"
      >
        <button
          type="button"
          role="menuitem"
          className={styles.item}
          onClick={() => onChoose("create")}
        >
          <span className={styles.icon}>👤</span>
          <span>Utilizador</span>
        </button>
        <div className={styles.sep} />
        <button
          type="button"
          role="menuitem"
          className={styles.item}
          onClick={() => onChoose("tags")}
        >
          <span className={styles.icon}>🏷️</span>
          <span>Tags</span>
        </button>
      </div>
      <div className={styles.arrow} />
    </div>
  );
}
