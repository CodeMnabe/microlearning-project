import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LoaderLink from "../components/TopLoader/LoaderLink";
import MarketingNavbar from "../components/Hero/Navbar/Navbar";
import Footer from "../components/Footer/Footer";
import ContactForm from "./ContactForm.jsx";
import styles from "./contact.module.css";

function Point({ children }) {
  return <li className={styles.pointItem}>{children}</li>;
}

export default function ContactPage() {
  const t = useTranslations("LandingPage.Contact");

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.background} aria-hidden="true" />

        <div className={styles.navRow}>
          <MarketingNavbar />
        </div>
        <div className={styles.container}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>{t("eyebrow")}</p>
            <h1 className={styles.title}>{t("title")}</h1>
            <p className={styles.subhead}>{t("subhead")}</p>
          </header>
          <div className={styles.grid}>
            <aside className={styles.infoCard}>
              <p className={styles.cardEyebrow}>{t("info.eyebrow")}</p>
              <h2 className={styles.cardTitle}>{t("info.title")}</h2>
              <p className={styles.cardText}>{t("info.description")}</p>

              <ul className={styles.pointList}>
                <Point>{t("info.points.one")}</Point>
                <Point>{t("info.points.two")}</Point>
                <Point>{t("info.points.three")}</Point>
              </ul>

              <LoaderLink href="/" className={styles.backLink}>
                {t("backHome")}
              </LoaderLink>
            </aside>

            <section className={styles.formCard}>
              <div className={styles.formTop}>
                <p className={styles.formEyebrow}>{t("form.eyebrow")}</p>
                <h2 className={styles.formTitle}>{t("form.title")}</h2>
                <p className={styles.formText}>{t("form.subhead")}</p>
              </div>

              <ContactForm />
            </section>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
