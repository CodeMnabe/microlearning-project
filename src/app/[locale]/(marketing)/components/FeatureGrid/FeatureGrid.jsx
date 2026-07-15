"use client";

import { useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import styles from "./FeatureGrid.module.css";
import content from "./FeatureGrid.json";
import useStickyStepJourney from "../ScrollJourney/useStickyStepJourney";

function FeatureVisual({ tile, title, mobile = false, priority = false }) {
  return (
    <div className={mobile ? styles.mobileVisual : styles.visualFrame}>
      <Image
        src={tile.image.src}
        alt={title}
        fill
        sizes={mobile ? "(max-width: 1023px) 100vw, 1px" : "46vw"}
        className={styles.visualImage}
        priority={priority}
      />
    </div>
  );
}

function FeatureCard({ tile, index, activeIndex }) {
  const t = useTranslations("LandingPage.FeatureGrid");
  const title = t(tile.titleKey);
  const isActive = index === activeIndex;
  const bullets = (tile.bulletsKeys || []).map((key) => t(key));

  return (
    <article
      className={`${styles.stepCard} ${isActive ? styles.stepCardActive : ""}`}
      data-feature-step
      data-step-index={index}
      aria-current={isActive ? "step" : undefined}
    >
      <div className={styles.stepMarker} aria-hidden="true">
        <span className={styles.stepNumber}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className={styles.stepDot} />
      </div>

      <div className={styles.stepContent}>
        <p className={styles.stepMeta} aria-hidden="true">
          {String(index + 1).padStart(2, "0")} / {String(content.tiles.length).padStart(2, "0")}
        </p>
        <h3 className={styles.stepTitle}>{title}</h3>
        <p className={styles.stepDescription}>{t(tile.descriptionKey)}</p>

        <FeatureVisual
          tile={tile}
          title={title}
          mobile
          priority={index === 0}
        />

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

export default function FeatureGrid() {
  const t = useTranslations("LandingPage.FeatureGrid");
  const rootRef = useRef(null);
  const activeIndex = useStickyStepJourney({
    rootRef,
    stepSelector: "[data-feature-step]",
    visualSelector: "[data-feature-visual]",
  });
  const activeTile = content.tiles[activeIndex];
  const activeTitle = t(activeTile.titleKey);
  const progress =
    content.tiles.length > 1 ? activeIndex / (content.tiles.length - 1) : 1;

  return (
    <section
      className={styles.wrap}
      id="how-it-works"
      ref={rootRef}
      data-motion="static"
      aria-labelledby="how-it-works-title"
    >
      <div className={styles.sectionInner}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>{t(content.eyebrowKey)}</p>
          <h2 className={styles.heading} id="how-it-works-title">
            {t(content.headingKey)}
          </h2>
          <p className={styles.subheading}>{t(content.subheadingKey)}</p>
        </header>

        <div className={styles.journey}>
          <div className={styles.visualColumn} aria-hidden="true">
            <div className={styles.visualSticky} data-feature-visual>
              <div className={styles.visualTopline}>
                <span className={styles.visualCount}>
                  {String(activeIndex + 1).padStart(2, "0")}
                </span>
                <span className={styles.visualTotal}>
                  / {String(content.tiles.length).padStart(2, "0")}
                </span>
              </div>

              <div className={styles.visualStack}>
                {content.tiles.map((tile, index) => (
                  <div
                    className={`${styles.visualLayer} ${index === activeIndex ? styles.visualLayerActive : ""}`}
                    key={tile.id}
                  >
                    <FeatureVisual
                      tile={tile}
                      title={t(tile.titleKey)}
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
                  {content.tiles.map((tile, index) => (
                    <span
                      className={`${styles.progressDot} ${index <= activeIndex ? styles.progressDotComplete : ""} ${index === activeIndex ? styles.progressDotActive : ""}`}
                      key={tile.id}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.stepsList}>
            {content.tiles.map((tile, index) => (
              <FeatureCard
                key={tile.id}
                tile={tile}
                index={index}
                activeIndex={activeIndex}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
