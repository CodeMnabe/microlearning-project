"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import styles from "./productPage.module.css";
import items from "./productPage.json";
import { MessageCircle, Bot, BookOpen, MapPin } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

const icons = {
  1: MessageCircle,
  2: Bot,
  3: BookOpen,
  4: MapPin,
  5: MessageCircle,
  6: Bot,
};

function ProductCard({ item, index, activeIndex }) {
  const t = useTranslations("ProductPage");
  const checks = item.checksKeys?.map((key) => t(key)) || [];
  const Icon = icons[item.id] || MessageCircle;
  const isActive = index === activeIndex;

  return (
    <article
      className={`${styles.productCard} ${isActive ? styles.productCardActive : ""}`}
      data-product-module
      data-module-index={index}
      aria-current={isActive ? "true" : undefined}
    >
      <div className={styles.productContent}>
        <div className={styles.productHeading}>
          <span className={styles.productNumber} aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className={styles.productTitle}>
            <span className={styles.productIcon} aria-hidden="true">
              <Icon size={18} strokeWidth={2.5} />
            </span>
            {t(item.titleKey)}
          </h3>
        </div>

        <p className={styles.productDescription}>{t(item.descriptionKey)}</p>

        {checks.length > 0 && (
          <ul className={styles.productChecks}>
            {checks.map((check, checkIndex) => (
              <li key={checkIndex}>{check}</li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.mobileMedia}>
        <Image
          src={item.image}
          alt={item.altKey ? t(item.altKey) : t(item.titleKey)}
          fill
          sizes="(max-width: 1023px) 92vw, 1px"
          className={styles.productImage}
          priority={index === 0}
        />
      </div>
    </article>
  );
}

export default function ProductExplorer() {
  const t = useTranslations("ProductPage");
  const rootRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || typeof window === "undefined") return;

      const visual = root.querySelector("[data-product-visual]");
      const visualPanel = visual?.firstElementChild;

      const syncVisualHeight = () => {
        if (!visual || !visualPanel) return;

        const panelHeight = visualPanel.getBoundingClientRect().height;
        if (panelHeight > 0) {
          visual.style.setProperty("--visual-height", `${panelHeight}px`);
        }
      };

      const visualResizeObserver =
        visualPanel && window.ResizeObserver
          ? new window.ResizeObserver(() => {
              syncVisualHeight();
              ScrollTrigger.refresh();
            })
          : null;

      visualResizeObserver?.observe(visualPanel);

      const mm = gsap.matchMedia();

      mm.add(
        {
          desktop: "(min-width: 1024px)",
          compact: "(max-width: 1023px)",
          motion: "(prefers-reduced-motion: no-preference)",
        },
        (context) => {
          const { desktop, compact, motion } = context.conditions;
          root.dataset.motion = motion ? "ready" : "reduced";
          root.dataset.layout = desktop && motion ? "sticky" : "flow";

          if (desktop && motion) syncVisualHeight();

          if (!motion) return;

          const modules = gsap.utils.toArray(
            root.querySelectorAll("[data-product-module]"),
          );

          if (desktop) {
            modules.forEach((module, index) => {
              ScrollTrigger.create({
                trigger: module,
                start: "top 58%",
                end: "bottom 42%",
                invalidateOnRefresh: true,
                onEnter: () => setActiveIndex(index),
                onEnterBack: () => setActiveIndex(index),
                onRefresh: (trigger) => {
                  if (trigger.isActive) setActiveIndex(index);
                },
              });
            });

            gsap.from("[data-product-visual-frame]", {
              y: 24,
              autoAlpha: 0,
              duration: 0.78,
              ease: "power3.out",
              scrollTrigger: {
                trigger: "[data-product-visual]",
                start: "top 84%",
                once: true,
              },
            });
          }

          if (compact) {
            modules.forEach((module) => {
              gsap.from(module, {
                y: 24,
                autoAlpha: 0,
                duration: 0.68,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: module,
                  start: "top 88%",
                  once: true,
                },
              });
            });
          }
        },
      );

      const refresh = () => ScrollTrigger.refresh();
      window.addEventListener("load", refresh, { once: true });

      return () => {
        root.dataset.motion = "static";
        root.dataset.layout = "flow";
        window.removeEventListener("load", refresh);
        visualResizeObserver?.disconnect();
        visual?.style.removeProperty("--visual-height");
        mm.revert();
      };
    },
    { scope: rootRef },
  );

  const activeItem = items[activeIndex];
  const activeTitle = t(activeItem.titleKey);

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

        <div className={styles.showcase}>
          <div className={styles.productCards}>
            {items.map((item, index) => (
              <ProductCard
                key={item.id}
                item={item}
                index={index}
                activeIndex={activeIndex}
              />
            ))}
          </div>

          <div className={styles.visualColumn} aria-hidden="true">
            <div className={styles.visualSticky} data-product-visual>
              <div className={styles.visualPanel}>
                <div className={styles.visualTopline}>
                  <span className={styles.visualLabel}>{activeTitle}</span>
                  <span className={styles.visualCount}>
                    {String(activeIndex + 1).padStart(2, "0")} /{" "}
                    {String(items.length).padStart(2, "0")}
                  </span>
                </div>

                <div
                  className={styles.visualFrame}
                  data-product-visual-frame
                >
                  <div className={styles.visualGlow} />
                  {items.map((item, index) => (
                    <div
                      className={`${styles.visualLayer} ${index === activeIndex ? styles.visualLayerActive : ""}`}
                      key={item.id}
                    >
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        sizes="(max-width: 1023px) 1px, 56vw"
                        className={styles.productImage}
                        priority={index === 0}
                      />
                    </div>
                  ))}
                </div>

                <div className={styles.moduleProgress}>
                  {items.map((item, index) => (
                    <span
                      className={`${styles.progressSegment} ${index <= activeIndex ? styles.progressSegmentSeen : ""} ${index === activeIndex ? styles.progressSegmentActive : ""}`}
                      key={item.id}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
