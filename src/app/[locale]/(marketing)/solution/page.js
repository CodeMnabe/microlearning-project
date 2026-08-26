import { useTranslations } from "next-intl";
import PersistentHeader from "@/app/components/Navbar/MarketingNavbar/PersistentHeader";
import Footer from "../components/Footer/Footer";
import SolutionExplorer from "./solutionExplorer.jsx";
import MarketingHeroActions from "../components/MarketingHeroActions/MarketingHeroActions";
import SolutionHeroBackdrop from "./SolutionHeroBackdrop.jsx";
import styles from "./solutionPage.module.css";

export default function SolutionPage() {
  const t = useTranslations("SolutionsPage");

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <SolutionHeroBackdrop />

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

      <SolutionExplorer />

      <div className={styles.footerWrap}>
        <Footer />
      </div>
    </main>
  );
}
