"use client";
import Image from "next/image";
import { useTranslations } from "next-intl";
import styles from "./productPage.module.css";
import items from "./productPage.json";

function ProductCard({ item, index }) {
  const t = useTranslations("ProductPage");

  const imageLeft = index % 2 === 1;

  const checks = item.checksKeys?.map((key) => t(key)) || [];

  return (
    <article
      className={`${styles.productCard} ${
        imageLeft ? styles.productCardReverse : ""
      }`}
    >
      <div className={styles.productContent}>
        <h3 className={styles.productTitle}>
          <span className={styles.productIcon} aria-hidden="true" />
          {t(item.titleKey)}
        </h3>

        <p className={styles.productDescription}>
          {t(item.descriptionKey)}
        </p>

        {checks.length > 0 && (
          <ul className={styles.productChecks}>
            {checks.map((check, index) => (
              <li key={index}>{check}</li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.productMedia}>
        <Image
          src={item.image}
          alt={item.altKey ? t(item.altKey) : t(item.titleKey)}
          fill
          sizes="(max-width: 900px) 100vw, 520px"
          className={styles.productImage}
          priority={index === 0}
        />
      </div>
    </article>
  );
}

export default function ProductExplorer() {
  const t = useTranslations("ProductPage");

  return (
    <section className={styles.explorer}>
      <div className={styles.explorerInner}>
        <header className={styles.topRow}>
          <p className={styles.sectionEyebrow}>{t("explorer.eyebrow")}</p>
            <h2 className={styles.sectionTitle}>{t("explorer.title")}</h2>
            <p className={styles.sectionText}>{t("explorer.subhead")}</p>
        </header>

        <div className={styles.productCards}>
          {items.map((item, index) => (
            <ProductCard key={item.id} item={item} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}