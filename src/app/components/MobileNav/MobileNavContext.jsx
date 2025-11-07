"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from "react";

const MobileNavCtx = createContext({
  open: false,
  toggle: () => {},
  close: () => {},
});

export function MobileNavProvider({ children }) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = open ? "hidden" : prev || "";
    return () => (document.body.style.overflow = prev || "");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <MobileNavCtx.Provider value={{ open, toggle, close }}>
      {children}
    </MobileNavCtx.Provider>
  );
}

export function useMobileNav() {
  return useContext(MobileNavCtx);
}
