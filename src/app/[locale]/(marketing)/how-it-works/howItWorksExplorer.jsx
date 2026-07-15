"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import styles from "./howItWorksPage.module.css";
import content from "./howItWorksPage.json";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

function StepVisual({ step, title, mobile = false, priority = false }) {
  return (
    <div className={mobile ? styles.mobileVisual : styles.visualFrame}>
      <div className={styles.visualGlow} aria-hidden="true" />
      <Image
        src={step.icon}
        alt={title}
        fill
        sizes={mobile ? "(max-width: 1023px) 100vw, 1px" : "46vw"}
        className={styles.visualImage}
        priority={priority}
      />
    </div>
  );
}

function StepCard({ step, index, activeIndex }) {
  const t = useTranslations("HowItWorksPage");
  const title = t(step.titleKey);
  const bullets = step.bulletsKeys?.map((key) => t(key)) || [];
  const isActive = index === activeIndex;

  return (
    <article
      className={`${styles.stepCard} ${isActive ? styles.stepCardActive : ""}`}
      data-process-step
      data-step-index={index}
      aria-current={isActive ? "step" : undefined}
    >
      <div className={styles.stepMarker} aria-hidden="true">
        <span className={styles.stepNumber}>
          {String(step.number).padStart(2, "0")}
        </span>
        <span className={styles.stepDot} />
      </div>

      <div className={styles.stepContent}>
        <p className={styles.stepMeta} aria-hidden="true">
          {String(step.number).padStart(2, "0")} /{" "}
          {String(content.steps.length).padStart(2, "0")}
        </p>
        <h3 className={styles.stepTitle}>{title}</h3>
        <p className={styles.stepDescription}>{t(step.descriptionKey)}</p>

        <StepVisual step={step} title={title} mobile priority={index === 0} />

        {bullets.length > 0 && (
          <ul className={styles.stepChecks}>
            {bullets.map((bullet, bulletIndex) => (
              <li key={bulletIndex}>{bullet}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function TechnicalCta() {
  const t = useTranslations("HowItWorksPage");

  return (
    <aside className={styles.ctaCard} data-process-cta>
      <div className={styles.ctaMedia}>
        <Image
          src={content.cta.image}
          alt={t("cta.alt")}
          fill
          sizes="(max-width: 900px) 100vw, 420px"
          className={styles.ctaImage}
        />
      </div>

      <div className={styles.ctaContent}>
        <h3 className={styles.ctaTitle}>{t("cta.title")}</h3>
        <p className={styles.ctaText}>{t("cta.text")}</p>

        <Link href={content.cta.href} className={styles.ctaButton}>
          {t("cta.button")}
        </Link>
      </div>
    </aside>
  );
}

export default function HowItWorksExplorer() {
  const t = useTranslations("HowItWorksPage");
  const rootRef = useRef(null);
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
            root.querySelectorAll("[data-process-step]"),
          );
          let cleanupVisualAlignment = () => {};

          if (desktop) {
            root.dataset.layout = "sticky";

            const visual = root.querySelector("[data-process-visual]");
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

            gsap.from("[data-process-visual]", {
              y: 28,
              autoAlpha: 0,
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: {
                trigger: "[data-process-visual]",
                start: "top 82%",
                once: true,
              },
            });
          }

          if (mobile) {
            root.dataset.layout = "flow";
            steps.forEach((step) => {
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

          gsap.from("[data-process-cta]", {
            y: 34,
            autoAlpha: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: "[data-process-cta]",
              start: "top 86%",
              once: true,
            },
          });

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
    { scope: rootRef },
  );

  const activeStep = content.steps[activeIndex];
  const activeTitle = t(activeStep.titleKey);
  const progress =
    content.steps.length > 1 ? activeIndex / (content.steps.length - 1) : 1;

  return (
    <section className={styles.explorer} ref={rootRef} data-motion="static">
      <div className={styles.explorerInner}>
        <header className={styles.topRow}>
          <p className={styles.sectionEyebrow}>{t("explorer.eyebrow")}</p>
          <h2 className={styles.sectionTitle}>{t("explorer.title")}</h2>
          <p className={styles.sectionText}>{t("explorer.subhead")}</p>
        </header>

        <div className={styles.journey}>
          <div className={styles.visualColumn} aria-hidden="true">
            <div className={styles.visualSticky} data-process-visual>
              <div className={styles.visualTopline}>
                <span className={styles.visualCount}>
                  {String(activeStep.number).padStart(2, "0")}
                </span>
                <span className={styles.visualTotal}>
                  / {String(content.steps.length).padStart(2, "0")}
                </span>
              </div>

              <div className={styles.visualStack}>
                {content.steps.map((step, index) => (
                  <div
                    className={`${styles.visualLayer} ${index === activeIndex ? styles.visualLayerActive : ""}`}
                    key={step.id}
                  >
                    <StepVisual
                      step={step}
                      title={t(step.titleKey)}
                      priority={index === 0}
                    />
                  </div>
                ))}
              </div>

              <div className={styles.visualFooter}>
                <p className={styles.visualTitle}>{activeTitle}</p>
                <div className={styles.progressTrack} aria-hidden="true">
                  <span
                    className={styles.progressFill}
                    style={{ transform: `scaleX(${progress})` }}
                  />
                </div>
                <div className={styles.progressDots} aria-hidden="true">
                  {content.steps.map((step, index) => (
                    <span
                      className={`${styles.progressDot} ${index <= activeIndex ? styles.progressDotComplete : ""} ${index === activeIndex ? styles.progressDotActive : ""}`}
                      key={step.id}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.stepsList}>
            {content.steps.map((step, index) => (
              <StepCard
                key={step.id}
                step={step}
                index={index}
                activeIndex={activeIndex}
              />
            ))}
          </div>
        </div>

        <TechnicalCta />
      </div>
    </section>
  );
}
