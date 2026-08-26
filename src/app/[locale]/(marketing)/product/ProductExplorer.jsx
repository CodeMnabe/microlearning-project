"use client";

import { useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { MessageCircle, Bot, BookOpen, MapPin } from "lucide-react";
import styles from "./productPage.module.css";
import items from "./productPage.json";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP);
}

const icons = {
  1: MessageCircle,
  2: Bot,
  3: BookOpen,
  4: MapPin,
};

const STEP_COUNT = items.length;
const TRANSITIONS = STEP_COUNT - 1;

function ProductStep({ item, index }) {
  const t = useTranslations("ProductPage");
  const checks = item.checksKeys?.map((key) => t(key)) || [];
  const Icon = icons[item.id] || MessageCircle;

  return (
    <article
      className={styles.storySlide}
      data-product-slide
      data-module-index={index}
    >
      <div className={styles.productContent}>
        <div className={styles.productMeta} aria-hidden="true">
          <span className={styles.productNumber}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className={styles.productIcon}>
            <Icon size={19} strokeWidth={2.25} />
          </span>
        </div>

        <h3 className={styles.productTitle}>{t(item.titleKey)}</h3>
        <p className={styles.productDescription}>{t(item.descriptionKey)}</p>

        {checks.length > 0 && (
          <ul className={styles.productChecks}>
            {checks.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.mobileMedia}>
        <Image
          src={item.image}
          alt={item.altKey ? t(item.altKey) : t(item.titleKey)}
          fill
          sizes="(max-width: 760px) 92vw, (max-width: 1023px) 54vw, 1px"
          className={styles.productImage}
          priority={index === 0}
        />
      </div>
    </article>
  );
}

/*
 * Layout is owned entirely by CSS (`position: sticky` + a fixed scroll runway on
 * .journey). JS owns only the animation: it reads the section's position once
 * per animation frame and pushes that single scalar into one paused timeline.
 *
 * Deliberately NOT using ScrollTrigger here: this app scrolls <body> (globals.css
 * sets `html, body { height: 100%; overflow-x: hidden }`), so the document itself
 * has zero scroll range. ScrollTrigger measures the viewport scroller, read 0,
 * and produced a NaN `end` plus a pin that could latch `position: fixed` and lock
 * the page. getBoundingClientRect() is scroller-agnostic, so this cannot happen.
 */
export default function ProductExplorer() {
  const t = useTranslations("ProductPage");
  const rootRef = useRef(null);
  const translatedTitles = items.map((item) => t(item.titleKey));

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || typeof window === "undefined") return;

      const mm = gsap.matchMedia();

      mm.add(
        {
          desktop: "(min-width: 1024px)",
          motion: "(prefers-reduced-motion: no-preference)",
        },
        (context) => {
          const { desktop, motion } = context.conditions;
          const useScrollStory = desktop && motion;

          root.dataset.motion = motion ? "ready" : "reduced";
          root.dataset.layout = useScrollStory ? "sticky" : "flow";

          if (!useScrollStory || TRANSITIONS < 1) return;

          const journey = root.querySelector("[data-product-journey]");
          const sticky = root.querySelector("[data-product-sticky]");
          const copyTrack = root.querySelector("[data-product-copy-track]");
          const slides = gsap.utils.toArray(
            root.querySelectorAll("[data-product-slide]"),
          );
          const visualLayers = gsap.utils.toArray(
            root.querySelectorAll("[data-product-visual-layer]"),
          );
          const visualLabel = root.querySelector("[data-product-visual-label]");
          const progressCount = root.querySelector(
            "[data-product-progress-count]",
          );
          const progressFill = root.querySelector(
            "[data-product-progress-fill]",
          );

          if (
            !journey ||
            !sticky ||
            !copyTrack ||
            slides.length !== STEP_COUNT ||
            visualLayers.length !== STEP_COUNT
          ) {
            return;
          }

          let activeIndex = -1;

          const setActiveStep = (nextIndex) => {
            const safeIndex = gsap.utils.clamp(0, TRANSITIONS, nextIndex);
            if (safeIndex === activeIndex) return;

            activeIndex = safeIndex;
            slides.forEach((slide, index) => {
              if (index === safeIndex) {
                slide.setAttribute("aria-current", "step");
              } else {
                slide.removeAttribute("aria-current");
              }
            });
            visualLayers.forEach((layer, index) => {
              layer.setAttribute(
                "aria-hidden",
                index === safeIndex ? "false" : "true",
              );
            });

            if (visualLabel)
              visualLabel.textContent = translatedTitles[safeIndex];
            if (progressCount) {
              progressCount.textContent = `${String(safeIndex + 1).padStart(2, "0")} / ${String(STEP_COUNT).padStart(2, "0")}`;
            }
          };

          gsap.set(copyTrack, { xPercent: 0 });
          gsap.set(visualLayers, { autoAlpha: 0, xPercent: 5 });
          gsap.set(visualLayers[0], { autoAlpha: 1, xPercent: 0 });
          gsap.set(progressFill, { scaleX: 0, transformOrigin: "0% 50%" });
          setActiveStep(0);

          const timeline = gsap.timeline({
            paused: true,
            defaults: { ease: "none" },
          });
          const transitionDelay = 0.14;
          const transitionDuration = 0.72;

          for (let index = 1; index < STEP_COUNT; index += 1) {
            const position = index - 1;

            /*
             * xPercent renders as a literal `translate(-100%)`, so one step is
             * always exactly one slide regardless of viewport width. No width
             * measurement means no NaN / Infinity / zero-width track, and resize
             * is handled by the browser with no JS at all.
             */
            timeline.to(
              copyTrack,
              {
                xPercent: -100 * index,
                duration: transitionDuration,
                ease: "power1.inOut",
              },
              position + transitionDelay,
            );
            timeline.to(
              visualLayers[index - 1],
              {
                autoAlpha: 0,
                xPercent: -5,
                duration: 0.24,
                ease: "power1.inOut",
              },
              position + 0.26,
            );
            timeline.fromTo(
              visualLayers[index],
              { autoAlpha: 0, xPercent: 5 },
              {
                autoAlpha: 1,
                xPercent: 0,
                duration: 0.24,
                ease: "power1.inOut",
              },
              position + 0.5,
            );
          }

          timeline.to(progressFill, { scaleX: 1, duration: TRANSITIONS }, 0);

          // Single source of truth: how far the sticky panel has travelled
          // inside its runway, derived purely from current layout.
          const readProgress = () => {
            const travel = journey.offsetHeight - sticky.offsetHeight;
            if (!(travel > 0)) return 0;
            return gsap.utils.clamp(
              0,
              1,
              -journey.getBoundingClientRect().top / travel,
            );
          };

          let frame = 0;

          const render = () => {
            frame = 0;
            const progress = readProgress();
            timeline.progress(progress);
            setActiveStep(Math.round(progress * TRANSITIONS));
          };

          const schedule = () => {
            if (!frame) frame = requestAnimationFrame(render);
          };

          render();

          // Capture phase so this also sees scroll events from <body>, which is
          // the real scroll container in this app (they do not bubble to window).
          document.addEventListener("scroll", schedule, {
            capture: true,
            passive: true,
          });
          window.addEventListener("resize", schedule, { passive: true });

          return () => {
            if (frame) cancelAnimationFrame(frame);
            document.removeEventListener("scroll", schedule, { capture: true });
            window.removeEventListener("resize", schedule);
            timeline.kill();
          };
        },
      );

      return () => {
        root.dataset.motion = "static";
        root.dataset.layout = "flow";
        mm.revert();
      };
    },
    { scope: rootRef, dependencies: [translatedTitles.join("|")] },
  );

  return (
    <section
      className={styles.explorer}
      ref={rootRef}
      data-motion="static"
      data-layout="flow"
    >
      <div className={styles.explorerInner}>
        <header className={styles.topRow}>
          <p className={styles.sectionEyebrow}>{t("explorer.eyebrow")}</p>
          <h2 className={styles.sectionTitle}>{t("explorer.title")}</h2>
        </header>

        <div
          className={styles.journey}
          data-product-journey
          style={{ "--journey-steps": TRANSITIONS }}
        >
          <div className={styles.journeySticky} data-product-sticky>
            <div className={styles.showcase}>
              <div className={styles.storyColumn}>
                <div className={styles.storyProgress} aria-hidden="true">
                  <span
                    className={styles.progressCount}
                    data-product-progress-count
                  >
                    01 / {String(STEP_COUNT).padStart(2, "0")}
                  </span>
                  <span className={styles.progressRail}>
                    <span
                      className={styles.progressFill}
                      data-product-progress-fill
                    />
                  </span>
                </div>

                <div
                  className={styles.storyViewport}
                  data-product-copy-viewport
                >
                  <div className={styles.storyTrack} data-product-copy-track>
                    {items.map((item, index) => (
                      <ProductStep key={item.id} item={item} index={index} />
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.visualColumn}>
                <figure className={styles.visualPanel}>
                  <figcaption className={styles.visualTopline}>
                    <span
                      className={styles.visualLabel}
                      data-product-visual-label
                    >
                      {translatedTitles[0]}
                    </span>
                  </figcaption>

                  <div className={styles.visualFrame}>
                    <div className={styles.visualGlow} aria-hidden="true" />
                    {items.map((item, index) => (
                      <div
                        className={styles.visualLayer}
                        data-product-visual-layer
                        aria-hidden={index === 0 ? "false" : "true"}
                        key={item.id}
                      >
                        <Image
                          src={item.image}
                          alt={item.altKey ? t(item.altKey) : t(item.titleKey)}
                          fill
                          sizes="(min-width: 1024px) 58vw, 1px"
                          className={styles.productImage}
                          priority={index === 0}
                        />
                      </div>
                    ))}
                  </div>
                </figure>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
