import PersistentHeader from "@/app/components/Navbar/MarketingNavbar/PersistentHeader";
import styles from "./public.module.css";
import Footer from "../(marketing)/components/Footer/Footer";

export default function PublicLayout({ children }) {
  return (
    <main className={styles.main}>
      <PersistentHeader reserveSpace />
      <div>{children}</div>
      <Footer />
    </main>
  );
}
