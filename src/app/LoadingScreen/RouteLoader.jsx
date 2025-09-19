"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useGlobalLoader } from "./GlobalLoaderContext";

export default function RouteLoader() {
  const pathname = usePathname();
  const { startLoading, stopLoading } = useGlobalLoader();

  // Stop loader whenever a new route has mounted
  //   useEffect(() => {
  //     stopLoading();
  //   }, [pathname, stopLoading]);

  // Start loader on internal link clicks
  useEffect(() => {
    const onClick = (e) => {
      const target = e.target;
      const a = target?.closest?.("a[href]");
      if (!a) return;

      // ignore new-tab/middle-clicks, downloads, external links, etc.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1)
        return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;

      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return; // external
      // in-page hash change: no route change
      if (
        url.pathname + url.search === location.pathname + location.search &&
        url.hash
      )
        return;

      startLoading();
    };

    document.addEventListener("click", onClick, { capture: true });
    return () =>
      document.removeEventListener("click", onClick, { capture: true });
  }, [startLoading]);

  // Start loader on browser back/forward
  useEffect(() => {
    const onPop = () => startLoading();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [startLoading]);

  return null;
}
