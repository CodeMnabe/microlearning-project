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
  portalToBody = true,
  fullWidth = false,
  className = "",
}) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 220 });
  const [direction, setDirection] = useState("down"); // "down" | "up"

  const selected = options.find((o) => String(o.value) === String(value));
  const label = selected?.label ?? placeholder;

  // Close on outside click / ESC + keep position updated
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
    function onResize() {
      reposition();
    }
    function onScroll() {
      reposition();
    }

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("resize", onResize);
    // capture=true catches scrolls in nested containers
    document.addEventListener("scroll", onScroll, true);

    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("scroll", onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Compute position & flip if needed
  const reposition = () => {
    if (!open || !triggerRef.current) return;

    const r = triggerRef.current.getBoundingClientRect();
    const width = menuWidth ?? r.width;
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, r.left));

    // Provisional place (down) to measure height
    const downTop = r.bottom + 6;
    setPos((p) => ({ ...p, top: downTop, left, width }));

    // Measure then decide up vs down
    requestAnimationFrame(() => {
      const mh = menuRef.current?.getBoundingClientRect().height ?? 0;
      const spaceBelow = window.innerHeight - (r.bottom + 6) - 12;
      const spaceAbove = r.top - 6 - 12;

      if (mh > spaceBelow && spaceAbove > spaceBelow) {
        // Open UP
        const upTop = Math.max(12, r.top - 6 - mh);
        setDirection("up");
        setPos({ top: upTop, left, width });
      } else {
        // Stay DOWN (clamp so it never goes off-screen)
        const clampedDown = Math.min(downTop, window.innerHeight - mh - 12);
        setDirection("down");
        setPos({ top: clampedDown, left, width });
      }
    });
  };

  // Reposition when opening or option count changes (height)
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, menuWidth, options.length]);

  const menuEl = (
    <div
      ref={menuRef}
      className={`${styles.menu} ${direction === "up" ? styles.menuUp : ""}`}
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
