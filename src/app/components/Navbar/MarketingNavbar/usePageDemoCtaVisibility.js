"use client";

import { useEffect, useLayoutEffect, useState } from "react";

// Pages opt in by marking their own primary demo CTA with this attribute
// (see e.g. the homepage hero or MarketingHeroActions). Pages that render no
// such element keep the header's fallback CTA visible at all times.
const PAGE_CTA_SELECTOR = "[data-page-demo-cta]";

// Resolving visibility during layout effect (before the browser paints the
// hydrated tree) instead of a plain effect keeps the header CTA's initial
// state from ever flashing the wrong way.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Shows the header's fallback demo CTA only while the page's own primary
 * demo CTA isn't usably visible (i.e. not on screen, or covered by the
 * fixed header). Centralized here so every marketing page gets the same
 * IntersectionObserver-driven behaviour just by marking its CTA.
 *
 * `headerRef` must point at the rendered header element so its live
 * bounding box (not a hardcoded height) can be excluded from the
 * intersection root.
 */
export default function usePageDemoCtaVisibility(headerRef) {
  // Defaults to hidden: most marketing pages do mark a hero CTA, and it is
  // visible at the top of the page on first load, so this is the state that
  // avoids the header CTA ever flashing in before the observer catches up.
  const [visible, setVisible] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const target = document.querySelector(PAGE_CTA_SELECTOR);

    if (!target) {
      setVisible(true);
      return undefined;
    }

    let observer = null;
    let frame = null;

    function createObserver() {
      observer?.disconnect();

      const headerHeight = headerRef.current
        ? Math.ceil(headerRef.current.getBoundingClientRect().bottom)
        : 0;

      // Shrinks the intersection root by the fixed header's real height so
      // a page CTA sitting underneath it is never treated as visible.
      observer = new IntersectionObserver(
        ([entry]) => setVisible(!entry.isIntersecting),
        { rootMargin: `-${Math.max(headerHeight, 0)}px 0px 0px 0px` },
      );
      observer.observe(target);
    }

    function scheduleRecreate() {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(createObserver);
    }

    createObserver();
    // The header's own box rarely resizes, but its offset from the top
    // (and so the safe-to-consider-visible line) shifts at responsive
    // breakpoints, so recompute from real geometry on resize.
    window.addEventListener("resize", scheduleRecreate);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", scheduleRecreate);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [headerRef]);

  return visible;
}
