"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function NavCursor() {
  const pathname = usePathname;
  const activeRef = useRef(false);

  const start = () => {
    if (activeRef.current) return;
    activeRef.current = true;
    document.documentElement.style.cursor = "progress";
    document.body.style.cursor = "progress";
  };

  const stop = () => {
    activeRef.current = false;
    document.documentElement.style.cursor = "";
    document.body.style.cursor = "";
  };

  useEffect(() => {
    const onClickCapture = (e) => {
      const a = e.target?.closest?.("a[href]");
      if (!a) return;

      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;

      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      const next = url.pathname + url.search;
      const current = window.location.pathname + window.location.search;
      if (next === current) return;

      start();
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, []);

  useEffect(() => {
    stop();
  }, [pathname]);

  return null;
}
