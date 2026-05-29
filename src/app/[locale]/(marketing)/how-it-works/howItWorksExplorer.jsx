"use client";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import styles from "./howItWorksPage.module.css";
import content from "./howItWorksPage.json";

function StepCard({ step, index }) {
  const t = useTranslations("HowItWorksPage");

  const bullets = step.bulletsKeys?.map((key) => t(key)) || [];

  return (
    <article className={styles.stepCard}>
      <div className={styles.stepNumber} aria-hidden="true">
        {step.number}
      </div>

      <div className={styles.stepContent}>
        <h3 className={styles.stepTitle}>{t(step.titleKey)}</h3>

        <p className={styles.stepDescription}>{t(step.descriptionKey)}</p>

        <div className={styles.stepDetails}>
          <div className={styles.stepIconFrame}>
            <Image
              src={step.icon}
              alt=""
              fill
              sizes="90px"
              className={styles.stepIconImage}
              priority={index === 0}
            />
          </div>

          {bullets.length > 0 && (
            <ul className={styles.stepChecks}>
              {bullets.map((bullet, bulletIndex) => (
                <li key={bulletIndex}>{bullet}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}

function TechnicalCta() {
  const t = useTranslations("HowItWorksPage");

  return (
    <aside className={styles.ctaCard}>
      <div className={styles.ctaMedia}>
        <Image
          src={content.cta.image}
          alt={t("cta.alt")}
          fill
          sizes="(max-width: 900px) 100vw, 260px"
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

  return (
    <section className={styles.explorer}>
      <div className={styles.explorerInner}>
        <header className={styles.topRow}>
          <p className={styles.sectionEyebrow}>{t("explorer.eyebrow")}</p>
          <h2 className={styles.sectionTitle}>{t("explorer.title")}</h2>
          <p className={styles.sectionText}>{t("explorer.subhead")}</p>
        </header>

        <div className={styles.stepsList}>
          {content.steps.map((step, index) => (
            <StepCard key={step.id} step={step} index={index} />
          ))}
        </div>

        <TechnicalCta />
      </div>
    </section>
  );
}