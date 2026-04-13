"use client";

import { useEffect } from "react";
import { useGlobalLoader } from "./GlobalLoaderContext";
import { usePathname, useSearchParams } from "next/navigation";

export default function RouteLoader() {
  const pathName = usePathname();
  const searchParams = useSearchParams();
  const { startLoading, stopLoading, showLoading } = useGlobalLoader();

  const routeKey = `${pathName}?${searchParams.toString()}`;

  useEffect(() => {
    stopLoading();
  }, [routeKey, stopLoading]);

  useEffect(() => {
    const onClick = (e) => {
      const a = e.target?.closest?.("a[href]");
      if (!a) return;

      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) {
        return;
      }
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;

      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;

      const next = url.pathname + url.search;
      const current = location.pathname + location.search;
      if (next === current) return;

      if (showLoading) return;
      startLoading();
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
    };
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
