"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./pillSelect.module.css";

export default function PillSelect({
  options = [], // [{ value, label }]
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  menuWidth, // optional fixed width for the menu
  portalToBody = true, // ⟵ NEW: render menu at document.body (fixes modal transform issue)
  fullWidth = false, // ⟵ NEW: make the trigger 100% wide (good for forms)
  className = "", // optional extra class for the trigger
}) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 220 });

  const selected = options.find((o) => String(o.value) === String(value));
  const label = selected?.label ?? placeholder;

  // close on outside/ESC
  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (menuRef.current?.contains(e.target)) return;
      if (triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // compute viewport position under the trigger
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const width = menuWidth ?? Math.max(220, r.width);
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, r.left));
    const top = Math.min(r.bottom + 6, window.innerHeight - 12);
    setPos({ top, left, width });
  }, [open, menuWidth]);

  const menuEl = (
    <div
      ref={menuRef}
      className={styles.menu}
      role="listbox"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
    >
      <div className={styles.list}>
        {options.map((o) => {
          const active = String(o.value) === String(value);
          return (
            <button
              key={o.value}
              role="option"
              aria-selected={active}
              className={`${styles.item} ${active ? styles.itemActive : ""}`}
              onClick={() => {
                onChange?.(o.value);
                setOpen(false);
              }}
            >
              <span className={styles.itemLabel}>{o.label}</span>
              {active && (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className={styles.check}
                >
                  <path d="M20 6L9 17l-5-5" strokeWidth="2" />
                </svg>
              )}
            </button>
          );
        })}
        {!options.length && <div className={styles.empty}>Sem opções.</div>}
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={`${styles.trigger} ${
          fullWidth ? styles.full : ""
        } ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={label}
      >
        <span className={styles.label}>{label}</span>
        <svg
          className={styles.caret}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path d="M6 9l6 6 6-6" strokeWidth="2" />
        </svg>
      </button>

      {open && (portalToBody ? createPortal(menuEl, document.body) : menuEl)}
    </>
  );
}
