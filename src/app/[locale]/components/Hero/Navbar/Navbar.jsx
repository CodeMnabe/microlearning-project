"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import styles from "./navbar.module.css";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Menu, X } from "lucide-react";

const NAV = [
  { href: "/learn", key: "learn" },
  { href: "/product", key: "product" },
  { href: "/pricing", key: "pricing" },
  { href: "/support", key: "support" },
  { href: "/company", key: "company" },
  // { href: "/blog", key: "blog" },
];

export default function MarketingNavbar() {
  const translation = useTranslations("LandingPage.Hero.Nav");
  const [isOpen, setIsOpen] = useState(false);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <header className={styles.navWrap}>
      <nav className={styles.navbar}>
        <div className={styles.topBar}>
          <Link href="/" className={styles.brand} onClick={closeMenu}>
            <Image
              src="/images/logo-03.png"
              alt="MyDigitalBot logo"
              width={28}
              height={28}
              className={styles.logoMark}
            />
            <span className={styles.brandText}>MyDigitalBot</span>
          </Link>

          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            aria-controls="marketing-navigation"
            aria-label={isOpen ? "Close menu" : "Open menu"}
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <div
          id="marketing-navigation"
          className={`${styles.navContent} ${isOpen ? styles.open : ""}`}
        >
          <div className={styles.navLinks}>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={styles.navLink}
                onClick={closeMenu}
              >
                {translation(item.key)}
              </Link>
            ))}
          </div>

          <div className={styles.navActions}>
            <Link
              href="/login"
              className={styles.loginLink}
              onClick={closeMenu}
            >
              {translation("login")}
            </Link>
            <Link
              href="/signup"
              className={styles.signupBtn}
              onClick={closeMenu}
            >
              {translation("book")}
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
