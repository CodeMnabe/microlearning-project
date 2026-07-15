import { useTranslations } from "next-intl";
import MarketingNavbar from "@/app/components/Navbar/MarketingNavbar/Navbar";
import LanguageSwitch from "@/app/components/TopBar/LanguageSwitch";
import Footer from "../components/Footer/Footer";
import ProductExplorer from "./ProductExplorer.jsx";
import MarketingHeroActions from "../components/MarketingHeroActions/MarketingHeroActions";
import InteractiveAmbientBackground from "../components/InteractiveAmbientBackground/InteractiveAmbientBackground";
import styles from "./productPage.module.css";

export default function ProductPage() {
  const t = useTranslations("ProductPage");

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.background} aria-hidden="true" />
        <InteractiveAmbientBackground
          variant="mist"
          intensity="subtle"
          interactive
        />

        <div className={styles.lang}>
          <LanguageSwitch />
        </div>

        <div className={styles.navRow}>
          <MarketingNavbar />
        </div>

        <div className={styles.container}>
          <header className={styles.header}>
            <div className={styles.heroLead}>
              <p className={styles.eyebrow}>{t("hero.eyebrow")}</p>
              <h1 className={styles.title}>{t("hero.title")}</h1>
            </div>

            <div className={styles.heroSupport}>
              <p className={styles.subhead}>{t("hero.subhead")}</p>
              <MarketingHeroActions
                primary={t("hero.primaryCta")}
                secondary={t("hero.secondaryCta")}
                secondaryHref="/contact"
              />
            </div>
          </header>
        </div>
      </section>

      <ProductExplorer />

      <div className={styles.footerWrap}>
        <Footer />
      </div>
    </main>
  );
}
