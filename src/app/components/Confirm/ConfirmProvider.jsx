"use client";
import { createContext, useContext, useEffect, useState } from "react";
import styles from "./confirm.module.css";

const ConfirmCtx = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    title: "",
    message: "",
    confirmText: "OK",
    cancelText: "Cancelar",
    tone: "default", // "default" | "danger"
    onResolve: null,
  });

  // keep mounted for close animation
  const [render, setRender] = useState(false);
  useEffect(() => {
    if (state.open) setRender(true);
  }, [state.open]);

  // promise-based confirm
  function confirm(opts = {}) {
    return new Promise((resolve) => {
      setState({
        open: true,
        title: opts.title ?? "Tem a certeza?",
        message: opts.message ?? "",
        confirmText: opts.confirmText ?? "OK",
        cancelText: opts.cancelText ?? "Cancelar",
        tone: opts.tone ?? "default",
        onResolve: resolve,
      });
    });
  }

  function close(result) {
    state.onResolve?.(result);
    setState((s) => ({ ...s, open: false, onResolve: null }));
  }

  // ESC to cancel
  useEffect(() => {
    if (!render) return;
    const onKey = (e) => e.key === "Escape" && close(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [render]); // eslint-disable-line

  return (
    <ConfirmCtx.Provider value={{ confirm }}>
      {children}

      {render && (
        <div
          className={`${styles.overlay} ${
            state.open ? styles.open : styles.closing
          }`}
          role="dialog"
          aria-modal="true"
          onAnimationEnd={(e) => {
            if (!state.open && e.target === e.currentTarget) setRender(false);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) close(false); // click outside
          }}
        >
          <div
            className={`${styles.card} ${
              state.open ? styles.open : styles.closing
            }`}
            role="document"
          >
            {!!state.title && <h3 className={styles.title}>{state.title}</h3>}
            {!!state.message && (
              <p className={styles.message}>{state.message}</p>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={() => close(false)}
              >
                {state.cancelText}
              </button>
              <button
                type="button"
                autoFocus
                className={`${styles.btnOk} ${
                  state.tone === "danger" ? styles.danger : ""
                }`}
                onClick={() => close(true)}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ctx.confirm;
}
