import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import styles from "./hero.module.css";
import MarketingNavbar from "./Navbar/Navbar";
import Chips from "./Chips/Chips";
import Cards from "./Cards/Cards";

import content from "./hero.json";

export default function Hero() {
  const t = useTranslations("LandingPage.Hero");

  const chips = content.chipsKeys.map((k) => t(k));
  const cards = content.cards.map((c) => ({
    ...c,
    title: t(c.titleKey),
    meta: t(c.metaKey),
  }));

  return (
    <section className={styles.hero}>
      <div className={styles.background} aria-hidden="true" />
      <div className={styles.navRow}>
        <MarketingNavbar />
      </div>

      <div className={styles.container}>
        <div className={styles.headline}>
          <h2 className={styles.title}>
            {t(content.titleLines[0])}
            <br />
            {t(content.titleLines[1])}
          </h2>

          <p className={styles.subhead}>
            {t(content.subheadLines[0])}
            <br />
            {/* {t(content.subheadLines[1])} */}
          </p>

          <div className={styles.actions}>
            <Link href={content.primaryCta.href} className={styles.primaryBtn}>
              {t(content.primaryCta.labelKey)}
            </Link>
            <Link
              href={content.secondaryCta.href}
              className={styles.secondaryBtn}
            >
              {t(content.secondaryCta.labelKey)}
            </Link>
          </div>

          <div className={styles.chipsWrap}>
            <Chips items={chips} />
          </div>

          <div className={styles.cardsWrap}>
            <Cards items={cards} />
          </div>
        </div>
      </div>
    </section>
  );
}
