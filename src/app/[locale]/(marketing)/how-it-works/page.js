import { useTranslations } from "next-intl";
import PersistentHeader from "@/app/components/Navbar/MarketingNavbar/PersistentHeader";
import Footer from "../components/Footer/Footer";
import HowItWorksExplorer from "./howItWorksExplorer";
import HowItWorksHeroLight from "./HowItWorksHeroLight";
import MarketingHeroActions from "../components/MarketingHeroActions/MarketingHeroActions";
import styles from "./howItWorksPage.module.css";

export default function HowItWorksPage() {
  const t = useTranslations("HowItWorksPage");

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.background} aria-hidden="true" />
        <HowItWorksHeroLight />

        <PersistentHeader reserveSpace />

        <div className={styles.container}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>{t("hero.eyebrow")}</p>
            <h1 className={styles.title}>{t("hero.title")}</h1>
            <p className={styles.subhead}>{t("hero.subhead")}</p>
            <MarketingHeroActions
              primary={t("hero.primaryCta")}
              secondary={t("hero.secondaryCta")}
              secondaryHref="/contact"
            />
          </header>
        </div>
      </section>

      <HowItWorksExplorer />

      <div className={styles.footerWrap}>
        <Footer />
      </div>
    </main>
  );
}
