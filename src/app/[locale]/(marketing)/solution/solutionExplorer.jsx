"use client";
import Image from "next/image";
import { useTranslations } from "next-intl";
import styles from "./solutionPage.module.css";
import items from "./solutionPage.json";

function SolutionCard({ item }) {
  const t = useTranslations("SolutionsPage");

  const bullets = item.bulletsKeys?.map((key) => t(key)) || [];

  return (
    <article className={`${styles.solutionCard} ${styles[item.variant]}`}>
      <div className={styles.solutionContent}>
        <h3 className={styles.solutionTitle}>{t(item.titleKey)}</h3>

        <p className={styles.solutionDescription}>
          {t(item.descriptionKey)}
        </p>

        {bullets.length > 0 && (
          <ul className={styles.solutionChecks}>
            {bullets.map((bullet, index) => (
              <li key={index}>{bullet}</li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.solutionMedia}>
        <Image
          src={item.image}
          alt={t(item.titleKey)}
          fill
          sizes="(max-width: 900px) 100vw, 520px"
          className={styles.solutionImage}
        />
      </div>
    </article>
  );
}

export default function SolutionExplorer() {
  const t = useTranslations("SolutionsPage");

  return (
    <section className={styles.explorer}>
      <div className={styles.explorerInner}>
        <header className={styles.topRow}>
          <p className={styles.sectionEyebrow}>{t("overview.eyebrow")}</p>
          <h2 className={styles.sectionTitle}>{t("overview.title")}</h2>
          <p className={styles.sectionText}>{t("overview.subtitle")}</p>
        </header>

        <div className={styles.solutionGrid}>
          {items.map((item) => (
            <SolutionCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}