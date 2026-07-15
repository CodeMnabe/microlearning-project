"use client";

import { useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import styles from "./solutionPage.module.css";
import items from "./solutionPage.json";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

function SolutionChapter({ item, index }) {
  const t = useTranslations("SolutionsPage");
  const bullets = item.bulletsKeys?.map((key) => t(key)) || [];
  const chapterNumber = String(index + 1).padStart(2, "0");

  return (
    <article
      className={`${styles.chapter} ${index % 2 ? styles.chapterReverse : ""}`}
      data-solution-chapter
    >
      <div className={styles.chapterRail} aria-hidden="true">
        <span className={styles.chapterNumber}>{chapterNumber}</span>
        <span className={styles.chapterTrace}>
          <span className={styles.chapterTraceFill} data-solution-trace />
        </span>
      </div>

      <div className={styles.chapterMedia} data-solution-media>
        <div className={styles.mediaHalo} aria-hidden="true" />
        <div className={styles.imageShell}>
          <Image
            src={item.image}
            alt={t(item.titleKey)}
            fill
            sizes="(max-width: 900px) 92vw, 58vw"
            className={styles.solutionImage}
            priority={index === 0}
          />
          <span className={styles.imageWash} aria-hidden="true" />
        </div>
      </div>

      <div className={styles.chapterCopy} data-solution-copy>
        <p className={styles.chapterMeta} aria-hidden="true">
          {chapterNumber} / {String(items.length).padStart(2, "0")}
        </p>
        <h3 className={styles.solutionTitle}>{t(item.titleKey)}</h3>
        <p className={styles.solutionDescription}>{t(item.descriptionKey)}</p>

        {bullets.length > 0 && (
          <ul className={styles.solutionChecks}>
            {bullets.map((bullet, index) => (
              <li key={index}>{bullet}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

export default function SolutionExplorer() {
  const t = useTranslations("SolutionsPage");
  const rootRef = useRef(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || typeof window === "undefined") return;

      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      root.dataset.motion = reduced ? "reduced" : "ready";

      if (reduced) return;

      const chapters = gsap.utils.toArray(
        root.querySelectorAll("[data-solution-chapter]"),
      );

      gsap.from("[data-solution-intro] > *", {
        y: 30,
        autoAlpha: 0,
        duration: 0.78,
        stagger: 0.09,
        ease: "power3.out",
        scrollTrigger: {
          trigger: "[data-solution-intro]",
          start: "top 84%",
          once: true,
        },
      });

      chapters.forEach((chapter, index) => {
        const media = chapter.querySelector("[data-solution-media]");
        const image = media?.querySelector("img");
        const copy = chapter.querySelector("[data-solution-copy]");
        const trace = chapter.querySelector("[data-solution-trace]");

        gsap.from(copy, {
          x: index % 2 ? -28 : 28,
          y: 18,
          autoAlpha: 0,
          duration: 0.82,
          ease: "power3.out",
          scrollTrigger: {
            trigger: chapter,
            start: "top 72%",
            once: true,
          },
        });

        gsap.fromTo(
          media,
          {
            clipPath: "inset(7% 7% 7% 7% round 30px)",
            autoAlpha: 0.58,
          },
          {
            clipPath: "inset(0% 0% 0% 0% round 30px)",
            autoAlpha: 1,
            ease: "none",
            scrollTrigger: {
              trigger: chapter,
              start: "top 88%",
              end: "center 56%",
              scrub: 0.45,
            },
          },
        );

        if (image) {
          gsap.fromTo(
            image,
            { scale: 1.055 },
            {
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: chapter,
                start: "top 86%",
                end: "bottom 28%",
                scrub: 0.5,
              },
            },
          );
        }

        gsap.fromTo(
          trace,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: chapter,
              start: "top 70%",
              end: "bottom 42%",
              scrub: true,
            },
          },
        );
      });

      const refresh = () => ScrollTrigger.refresh();
      window.addEventListener("load", refresh, { once: true });

      return () => {
        root.dataset.motion = "static";
        window.removeEventListener("load", refresh);
      };
    },
    { scope: rootRef },
  );

  return (
    <section className={styles.explorer} ref={rootRef} data-motion="static">
      <div className={styles.explorerInner}>
        <header className={styles.topRow} data-solution-intro>
          <p className={styles.sectionEyebrow}>{t("overview.eyebrow")}</p>
          <h2 className={styles.sectionTitle}>{t("overview.title")}</h2>
          <p className={styles.sectionText}>{t("overview.subtitle")}</p>
        </header>

        <div className={styles.narrative}>
          {items.map((item, index) => (
            <SolutionChapter key={item.id} item={item} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
