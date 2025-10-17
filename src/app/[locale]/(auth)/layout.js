import LanguageSwitch from "@/app/components/TopBar/LanguageSwitch";
import styles from "./auth-layout.module.css";

export default function AuthLayout({ children }) {
  return (
    <div className={styles.frame}>
      <div className={styles.lang}>
        <LanguageSwitch />
      </div>
      {children}
    </div>
  );
}
