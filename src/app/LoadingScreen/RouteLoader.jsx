"use client";

import { useEffect } from "react";
import { useGlobalLoader } from "./GlobalLoaderContext";
import { usePathname } from "next/navigation";

export default function RouteLoader() {
  const pathName = usePathname();
  const { startLoading, stopLoading, showLoading } = useGlobalLoader();

  useEffect(() => {
    stopLoading();
  }, [stopLoading]);

  useEffect(() => {
    const onClick = (e) => {
      const a = e.target?.closest?.("a[href]");
      if (!a) return;

      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1)
        return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;

      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;

      const next = url.pathname + url.search;
      const current = location.pathname + location.search;
      if (next === current) return; // no real nav

      if (showLoading) return; // ← key line: don't re-start while visible
      startLoading();
    };
    document.addEventListener("click", onClick, { capture: true });
    return () =>
      document.removeEventListener("click", onClick, { capture: true });
  }, [startLoading, showLoading]);

  useEffect(() => {
    const onPop = () => {
      if (!showLoading) startLoading();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [startLoading, showLoading]);

  return null;
}
