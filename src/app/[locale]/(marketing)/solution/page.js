import { useTranslations } from "next-intl";
import MarketingNavbar from "@/app/components/Navbar/MarketingNavbar/Navbar";
import LanguageSwitch from "@/app/components/TopBar/LanguageSwitch";
import Footer from "../components/Footer/Footer";
import SolutionExplorer from "./solutionExplorer.jsx";
import MarketingHeroActions from "../components/MarketingHeroActions/MarketingHeroActions";
import InteractiveAmbientBackground from "../components/InteractiveAmbientBackground/InteractiveAmbientBackground";
import styles from "./solutionPage.module.css";

export default function SolutionPage() {
  const t = useTranslations("SolutionsPage");

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.background} aria-hidden="true" />
        <InteractiveAmbientBackground
          variant="aurora"
          intensity="subtle"
          interactive
        />

        <div className={styles.heroSignal} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className={styles.lang}>
          <LanguageSwitch />
        </div>

        <div className={styles.navRow}>
          <MarketingNavbar />
        </div>

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

      <SolutionExplorer />

      <div className={styles.footerWrap}>
        <Footer />
      </div>
    </main>
  );
}
