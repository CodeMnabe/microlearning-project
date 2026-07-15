"use client";

import { useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export default function useStickyStepJourney({
  rootRef,
  stepSelector,
  visualSelector,
  entrySelector = visualSelector,
  mobileStepSelector = stepSelector,
  ctaSelector,
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || typeof window === "undefined") return;

      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      root.dataset.motion = reduced ? "reduced" : "ready";

      if (reduced) return;

      const mm = gsap.matchMedia();

      mm.add(
        {
          desktop: "(min-width: 1024px)",
          mobile: "(max-width: 1023px)",
          motion: "(prefers-reduced-motion: no-preference)",
        },
        (context) => {
          const { desktop, mobile, motion } = context.conditions;
          if (!motion) return;

          const steps = gsap.utils.toArray(
            root.querySelectorAll(stepSelector),
          );
          let cleanupVisualAlignment = () => {};

          if (desktop) {
            root.dataset.layout = "sticky";

            const visual = root.querySelector(visualSelector);
            if (visual) {
              const updateVisualAlignment = () => {
                const minimumTop = window.innerHeight <= 680 ? 16 : 24;
                const centeredTop =
                  (window.innerHeight - visual.offsetHeight) / 2;

                visual.style.setProperty(
                  "--visual-sticky-top",
                  `${Math.max(minimumTop, Math.round(centeredTop))}px`,
                );
              };

              const resizeObserver =
                "ResizeObserver" in window
                  ? new ResizeObserver(updateVisualAlignment)
                  : null;

              updateVisualAlignment();
              resizeObserver?.observe(visual);
              window.addEventListener("resize", updateVisualAlignment);

              cleanupVisualAlignment = () => {
                resizeObserver?.disconnect();
                window.removeEventListener("resize", updateVisualAlignment);
                visual.style.removeProperty("--visual-sticky-top");
              };
            }

            steps.forEach((step, index) => {
              ScrollTrigger.create({
                trigger: step,
                start: "top 56%",
                end: "bottom 44%",
                invalidateOnRefresh: true,
                onEnter: () => setActiveIndex(index),
                onEnterBack: () => setActiveIndex(index),
                onToggle: (self) => {
                  if (self.isActive) setActiveIndex(index);
                },
              });
            });

            gsap.from(entrySelector, {
              y: 28,
              autoAlpha: 0,
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: {
                trigger: entrySelector,
                start: "top 82%",
                once: true,
              },
            });
          }

          if (mobile) {
            root.dataset.layout = "flow";
            root.querySelectorAll(mobileStepSelector).forEach((step) => {
              gsap.from(step, {
                y: 28,
                autoAlpha: 0,
                duration: 0.72,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: step,
                  start: "top 88%",
                  once: true,
                },
              });
            });
          }

          if (ctaSelector) {
            gsap.from(ctaSelector, {
              y: 34,
              autoAlpha: 0,
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: {
                trigger: ctaSelector,
                start: "top 86%",
                once: true,
              },
            });
          }

          return cleanupVisualAlignment;
        },
      );

      const refresh = () => ScrollTrigger.refresh();
      window.addEventListener("load", refresh, { once: true });

      return () => {
        root.dataset.motion = "static";
        root.dataset.layout = "flow";
        window.removeEventListener("load", refresh);
        mm.revert();
      };
    },
    {
      scope: rootRef,
      dependencies: [
        entrySelector,
        mobileStepSelector,
        stepSelector,
        visualSelector,
        ctaSelector,
      ],
    },
  );

  return activeIndex;
}
