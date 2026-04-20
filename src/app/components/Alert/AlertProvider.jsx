"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./alert.module.css";

const AlertCtx = createContext(null);

export function AlertProvider({ children }) {
  const translation = useTranslations("Alert");
  const [state, setState] = useState({
    open: false,
    title: "",
    message: "",
    confirmText: "",
    cancelText: "",
    tone: "default", // "default" | "success" | "danger" | "warning"
    onResolve: null,
  });

  const [render, setRender] = useState(false);
  useEffect(() => {
    if (state.open) setRender(true);
  }, [state.open]);

  function alert(opts = {}) {
    return new Promise((resolve) => {
      setState({
        open: true,
        title: opts.title ?? translation("title"),
        message: opts.message ?? "",
        buttonText: opts.buttonText ?? translation("ok"),
        tone: opts.tone ?? "default",
        onResolve: resolve,
      });
    });
  }

  function close(result) {
    state.onResolve?.(result);
    setState((s) => ({ ...s, open: false, onResolve: null }));
  }

  useEffect(() => {
    if (!render) return;
    const onKey = (e) => e.key === "Escape" && close(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [render]);

  return (
    <AlertCtx.Provider value={{ alert }}>
      {children}

      {render && (
        <div
          className={`${styles.overlay} ${
            state.open ? styles.open : styles.closing
          }`}
          role="alertdialog"
          aria-modal="true"
          onAnimationEnd={(e) => {
            if (!state.open && e.target === e.currentTarget) setRender(false);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) close(false);
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
                autoFocus
                className={`${styles.btnOk} ${
                  state.tone === "success"
                    ? styles.success
                    : state.tone === "danger"
                      ? styles.danger
                      : state.tone === "warning"
                        ? styles.warning
                        : ""
                }`}
                onClick={close}
              >
                {state.buttonText}
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertCtx.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(AlertCtx);
  if (!ctx) throw new Error("useAlert must be used inside AlertProvider");
  return ctx.alert;
}
