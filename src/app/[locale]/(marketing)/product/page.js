import { useTranslations } from "next-intl";
import PersistentHeader from "@/app/components/Navbar/MarketingNavbar/PersistentHeader";
import Footer from "../components/Footer/Footer";
import ProductExplorer from "./ProductExplorer.jsx";
import MarketingHeroActions from "../components/MarketingHeroActions/MarketingHeroActions";
import ProductHeroBackdrop from "./ProductHeroBackdrop.jsx";
import styles from "./productPage.module.css";

export default function ProductPage() {
  const t = useTranslations("ProductPage");

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.background} aria-hidden="true" />
        <ProductHeroBackdrop />

        <PersistentHeader reserveSpace />

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
