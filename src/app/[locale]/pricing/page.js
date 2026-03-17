import { useTranslations } from "next-intl";
import MarketingNavbar from "../components/Hero/Navbar/Navbar";
import LanguageSwitch from "@/app/components/TopBar/LanguageSwitch";
import Footer from "../components/Footer/Footer";
import PricingExplorer from "./PricingExplorer.jsx";
import styles from "./pricingPage.module.css";

export default function PricingPage() {
  const t = useTranslations("PricingPage");

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.background} aria-hidden="true" />

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
          </header>
        </div>
      </section>

      <PricingExplorer />
      <Footer />
    </main>
  );
}
