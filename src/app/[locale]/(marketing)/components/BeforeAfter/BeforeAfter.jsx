import Image from "next/image";
import { useTranslations } from "next-intl";
import styles from "./BeforeAfter.module.css";
import content from "./beforeAfter.json";

function Side({ label, bullets = [], image, tone = "bad" }) {
  return (
    <div className={styles.side}>
      <div className={styles.mock}>
        {image?.src ? (
          <div className={styles.imageWrap}>
            <Image
              src={image.src}
              alt={image.alt || ""}
              fill
              sizes="(max-width: 900px) 100vw, 520px"
              className={styles.image}
              priority={image.priority}
            />
          </div>
        ) : (
          <div className={styles.placeholder} aria-hidden="true" />
        )}
      </div>

      <div className={styles.dividerRow}>
        <span className={styles.dividerLine} />
        <span className={styles.pill}>{label}</span>
        <span className={styles.dividerLine} />
      </div>

      <ul
        className={`${styles.list} ${tone === "good" ? styles.good : styles.bad}`}
      >
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    </div>
  );
}

export default function BeforeAfter() {
  const t = useTranslations("LandingPage.BeforeAfter");

  const before = {
    label: t(content.before.labelKey),
    tone: content.before.tone,
    image: {
      ...content.before.image,
      alt: content.before.image?.altKey ? t(content.before.image.altKey) : "",
    },
    bullets: content.before.bulletsKeys.map((k) => t(k)),
  };

  const after = {
    label: t(content.after.labelKey),
    tone: content.after.tone,
    image: {
      ...content.after.image,
      alt: content.after.image?.altKey ? t(content.after.image.altKey) : "",
    },
    bullets: content.after.bulletsKeys.map((k) => t(k)),
  };

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <h2 className={styles.heading}>{t(content.headingKey)}</h2>
        <p className={styles.subheading}>{t(content.subheadingKey)}</p>
      </header>

      <div className={styles.grid}>
        <Side {...before} />
        <Side {...after} />
      </div>
    </section>
  );
}
