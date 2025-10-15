"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import styles from "./users.module.css";

export default function FilterMenu({
  open,
  anchorEl,
  tags = [],
  assistants = [],
  selectedTagIds = [],
  setSelectedTagIds,
  selectedAssistantIds = [],
  setSelectedAssistantIds,
  onClose,
  onClear,
}) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [q, setQ] = useState("");

  // close on outside click / ESC
  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (!ref.current) return;
      if (ref.current.contains(e.target)) return;
      if (anchorEl && anchorEl.contains?.(e.target)) return;
      onClose?.();
    }
    function onEsc(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, anchorEl, onClose]);

  // position next to the button
  useLayoutEffect(() => {
    if (!open || !anchorEl) return;
    const btn = anchorEl.getBoundingClientRect();
    const menuW = 360;
    const gap = 8;
    const left = Math.min(
      Math.max(12, btn.left),
      window.innerWidth - menuW - 12
    );
    const top = Math.min(btn.bottom + gap, window.innerHeight - 12);
    setPos({ top, left });
  }, [open, anchorEl]);

  if (!open || !anchorEl) return null;

  const fTags = tags.filter(
    (t) => !q.trim() || t.name.toLowerCase().includes(q.toLowerCase())
  );
  const fAssistants = assistants.filter(
    (a) => !q.trim() || a.name.toLowerCase().includes(q.toLowerCase())
  );

  function toggle(setter, list, id) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  return (
    <div
      ref={ref}
      className={styles.filterPopover}
      style={{ top: pos.top, left: pos.left, width: 360 }}
      role="dialog"
      aria-label="Filtros"
    >
      <div className={styles.filterHead}>
        <input
          className={styles.filterSearch}
          placeholder="Procurar…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className={styles.filterGhost} onClick={onClear} title="Limpar">
          Limpar
        </button>
        <button className={styles.filterGhost} onClick={onClose} title="Fechar">
          <X size={16} />
        </button>
      </div>

      <div className={styles.filterSection}>
        <div className={styles.filterTitle}>Tags</div>
        <div className={styles.filterList}>
          {fTags.map((t) => {
            const checked = selectedTagIds.includes(t.id);
            return (
              <label key={t.id} className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    toggle(setSelectedTagIds, selectedTagIds, t.id)
                  }
                />
                <span>{t.name}</span>
              </label>
            );
          })}
          {!fTags.length && (
            <div className={styles.filterEmpty}>Sem resultados.</div>
          )}
        </div>
      </div>

      <div className={styles.filterSection}>
        <div className={styles.filterTitle}>Assistentes</div>
        <div className={styles.filterList}>
          {fAssistants.map((a) => {
            const checked = selectedAssistantIds.includes(a.id);
            return (
              <label key={a.id} className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    toggle(setSelectedAssistantIds, selectedAssistantIds, a.id)
                  }
                />
                <span>{a.name}</span>
              </label>
            );
          })}
          {!fAssistants.length && (
            <div className={styles.filterEmpty}>Sem resultados.</div>
          )}
        </div>
      </div>
    </div>
  );
}
