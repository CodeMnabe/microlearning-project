import LanguageSwitch from "@/app/components/TopBar/LanguageSwitch";
import MarketingNavbar from "@/app/components/Navbar/MarketingNavbar/Navbar";
import styles from "./public.module.css";
import Footer from "../(marketing)/components/Footer/Footer";

export default function PublicLayout({ children }) {
  return (
    <main className={styles.main}>
      <div className={styles.publicNav}>
        <MarketingNavbar
          trailing={
            <div className={styles.navLanguage}>
              <LanguageSwitch />
            </div>
          }
        />
      </div>
      <div>{children}</div>
      <Footer />
    </main>
  );
}
