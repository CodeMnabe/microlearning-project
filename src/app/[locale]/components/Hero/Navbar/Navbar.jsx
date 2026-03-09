import { Link } from "@/i18n/navigation";
import styles from "./navbar.module.css";
import { useTranslations } from "next-intl";
import Image from "next/image";

const NAV = [
  { href: "/learn", key: "learn" },
  { href: "/product", key: "product" },
  { href: "/pricing", key: "pricing" },
  { href: "/support", key: "support" },
  { href: "/company", key: "company" },
  { href: "/blog", key: "blog" },
];

export default function MarketingNavbar() {
  const translation = useTranslations("LandingPage.Hero.Nav");
  return (
    <header className={styles.navWrap}>
      <nav className={styles.navbar}>
        <Link href="/" className={styles.brand}>
          <Image
            src="/images/logo-03.png"
            alt="MyDigitalBot logo"
            width={28}
            height={28}
            className={styles.logoMark}
          />
          <span className={styles.brandText}>MyDigitalBot</span>
        </Link>

        <div className={styles.navLinks}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              {translation(item.key)}
            </Link>
          ))}
        </div>

        <div className={styles.navActions}>
          <Link href="/login" className={styles.loginLink}>
            {translation("login")}
          </Link>
          <Link href="/signup" className={styles.signupBtn}>
            {translation("book")}
          </Link>
        </div>
      </nav>
    </header>
  );
}
