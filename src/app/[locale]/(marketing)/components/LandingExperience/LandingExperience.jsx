"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import styles from "./landingExperience.module.css";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export default function LandingExperience({ children }) {
  const rootRef = useRef(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || typeof window === "undefined") return;

      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      root.dataset.motion = reduced ? "reduced" : "ready";

      const sceneVideos = Array.from(
        root.querySelectorAll("[data-scene-video]"),
      );
      let videoObserver;

      if (!reduced && "IntersectionObserver" in window) {
        videoObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              const video = entry.target;
              if (entry.isIntersecting && entry.intersectionRatio > 0.65) {
                sceneVideos.forEach((other) => {
                  if (other !== video) other.pause();
                });
                video.play().catch(() => {});
              } else {
                video.pause();
              }
            });
          },
          { threshold: [0, 0.65, 1] },
        );
        sceneVideos.forEach((video) => videoObserver.observe(video));
      }

      if (!reduced) {
        gsap.from("[data-hero-word]", {
          yPercent: 115,
          autoAlpha: 0,
          duration: 1.05,
          stagger: 0.045,
          ease: "power4.out",
          delay: 0.12,
        });
        gsap.from("[data-hero-intro]", {
          y: 24,
          autoAlpha: 0,
          duration: 0.8,
          stagger: 0.1,
          ease: "power3.out",
          delay: 0.55,
        });
      }

      const mm = gsap.matchMedia();

      mm.add(
        {
          desktop: "(min-width: 1024px)",
          motion: "(prefers-reduced-motion: no-preference)",
        },
        (context) => {
          const { desktop, motion } = context.conditions;
          if (!desktop || !motion) return;

          const transform = root.querySelector('[data-scene="transformation"]');
          if (transform) {
            const signals = Array.from(
              transform.querySelectorAll("[data-signal]"),
            );
            const platform = transform.querySelector("[data-platform]");
            const platformItems = transform.querySelectorAll(
              "[data-platform-item]",
            );
            const statuses = Array.from(
              transform.querySelectorAll("[data-story-status]"),
            );
            const flowLines = transform.querySelectorAll("[data-flow-line]");
            const progress = transform.querySelector("[data-story-progress]");
            const glow = transform.querySelector("[data-stage-glow]");

            gsap.set(statuses[0], { autoAlpha: 1, y: 0 });
            gsap.set(statuses.slice(1), { autoAlpha: 0, y: 10 });
            gsap.set(signals, {
              autoAlpha: 1,
              scale: 1,
              filter: "blur(0px)",
            });
            gsap.set(platform, {
              autoAlpha: 0,
              scale: 0.9,
              y: 30,
              filter: "blur(12px)",
            });
            gsap.set(platformItems, { autoAlpha: 0, y: 18 });
            gsap.set(flowLines, { scaleX: 0, transformOrigin: "0% 50%" });
            gsap.set(progress, { scaleX: 0, transformOrigin: "0% 50%" });

            const story = gsap.timeline({
              defaults: { ease: "none" },
              scrollTrigger: {
                trigger: transform,
                start: "top top",
                end: "bottom bottom",
                scrub: 0.5,
              },
            });

            story
              .to(progress, { scaleX: 0.42, duration: 0.45 }, 0.08)
              .to(statuses[0], { autoAlpha: 0, y: -10, duration: 0.12 }, 0.25)
              .to(statuses[1], { autoAlpha: 1, y: 0, duration: 0.14 }, 0.3)
              .to(flowLines, { scaleX: 1, duration: 0.24, stagger: 0.035 }, 0.3)
              .to(
                signals,
                {
                  x: (_, element) => Number(element.dataset.gatherX),
                  y: (_, element) => Number(element.dataset.gatherY),
                  scale: 0.58,
                  autoAlpha: 0,
                  filter: "blur(9px)",
                  duration: 0.36,
                  stagger: 0.05,
                },
                0.36,
              )
              .to(
                flowLines,
                {
                  autoAlpha: 0,
                  scaleX: 0.2,
                  transformOrigin: "100% 50%",
                  duration: 0.2,
                },
                0.58,
              )
              .to(
                platform,
                {
                  autoAlpha: 1,
                  scale: 1,
                  y: 0,
                  filter: "blur(0px)",
                  duration: 0.38,
                  ease: "power2.out",
                },
                0.48,
              )
              .to(
                platformItems,
                {
                  autoAlpha: 1,
                  y: 0,
                  duration: 0.24,
                  stagger: 0.045,
                  ease: "power2.out",
                },
                0.64,
              )
              .to(statuses[1], { autoAlpha: 0, y: -10, duration: 0.12 }, 0.68)
              .to(statuses[2], { autoAlpha: 1, y: 0, duration: 0.18 }, 0.74)
              .to(progress, { scaleX: 1, duration: 0.42 }, 0.55)
              .to(
                glow,
                {
                  opacity: 1,
                  scale: 1.08,
                  duration: 0.42,
                  ease: "power2.out",
                },
                0.56,
              );
          }

          const product = root.querySelector('[data-scene="product"]');
          const acts = product
            ? Array.from(product.querySelectorAll("[data-product-act]"))
            : [];
          if (product && acts.length > 1) {
            gsap.set(acts, { zIndex: (index) => index + 1 });
            gsap.set(acts.slice(1), {
              xPercent: 28,
              scale: 0.98,
              autoAlpha: 0,
            });
            const productTimeline = gsap.timeline({
              scrollTrigger: {
                trigger: product,
                start: "top top",
                end: "bottom bottom",
                scrub: 0.42,
              },
            });

            acts.slice(1).forEach((act, index) => {
              const previous = acts[index];
              const position = index + 1;
              productTimeline
                .to(
                  previous,
                  {
                    xPercent: -8,
                    scale: 0.96,
                    autoAlpha: 0,
                    duration: 0.5,
                    ease: "none",
                  },
                  position,
                )
                .to(
                  act,
                  {
                    xPercent: 0,
                    scale: 1,
                    autoAlpha: 1,
                    duration: 0.5,
                    ease: "none",
                  },
                  position + 0.12,
                );
            });
          }

          const pricing = root.querySelector('[data-scene="pricing"]');
          if (pricing) {
            gsap.from(pricing.querySelectorAll("[data-plan-card]"), {
              y: 100,
              rotate: (index) => (index - 1) * 2.5,
              autoAlpha: 0,
              stagger: 0.12,
              ease: "none",
              scrollTrigger: {
                trigger: pricing,
                start: "top 70%",
                end: "center 55%",
                scrub: 0.3,
              },
            });
          }
        },
      );

      if (!reduced) {
        root.querySelectorAll("[data-reveal]").forEach((element) => {
          gsap.from(element, {
            y: 42,
            autoAlpha: 0,
            duration: 0.85,
            ease: "power3.out",
            scrollTrigger: {
              trigger: element,
              start: "top 86%",
              once: true,
            },
          });
        });
      }

      const magnetic = Array.from(root.querySelectorAll("[data-magnetic]"));
      const finePointer = window.matchMedia("(pointer: fine)").matches;
      const cleanups = [];

      if (!reduced && finePointer) {
        magnetic.forEach((element) => {
          const move = (event) => {
            const rect = element.getBoundingClientRect();
            const x = event.clientX - rect.left - rect.width / 2;
            const y = event.clientY - rect.top - rect.height / 2;
            gsap.to(element, {
              x: x * 0.14,
              y: y * 0.14,
              duration: 0.35,
              ease: "power2.out",
            });
          };
          const leave = () =>
            gsap.to(element, {
              x: 0,
              y: 0,
              duration: 0.5,
              ease: "elastic.out(1, 0.5)",
            });
          element.addEventListener("pointermove", move);
          element.addEventListener("pointerleave", leave);
          cleanups.push(() => {
            element.removeEventListener("pointermove", move);
            element.removeEventListener("pointerleave", leave);
          });
        });
      }

      const refresh = () => ScrollTrigger.refresh();
      window.addEventListener("load", refresh, { once: true });

      return () => {
        root.dataset.motion = "static";
        videoObserver?.disconnect();
        sceneVideos.forEach((video) => video.pause());
        cleanups.forEach((cleanup) => cleanup());
        window.removeEventListener("load", refresh);
        mm.revert();
      };
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className={styles.experience} data-motion="static">
      {children}
    </div>
  );
}
