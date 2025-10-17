// src/app/components/Navbar/NavItem.jsx
"use client";
import { Link, usePathname } from "@/i18n/navigation";
import { useState } from "react";
import styles from "./navbar.module.css";

export default function NavItem({ href, icon: Icon, children, onClick }) {
  const pathname = usePathname();
  const pathNoLocale = pathname.replace(/^\/(en|pt)(?=\/|$)/, "") || "/";
  const isActive = pathNoLocale === href || pathNoLocale.startsWith(href + "/");

  const [clicked, setClicked] = useState(false);
  function playSweep(e) {
    setClicked(false);
    requestAnimationFrame(() => setClicked(true));
    onClick?.(e);
  }

  // NOTE: href stays like "/users"; the locale-aware Link will prefix it.
  return (
    <Link
      href={href}
      onClick={playSweep}
      className={[
        styles.navItem,
        isActive ? styles.active : "",
        clicked ? styles.clicked : "",
      ].join(" ")}
    >
      {Icon ? <Icon aria-hidden className={styles.icon} /> : null}
      <span className={styles.label}>{children}</span>
      <span aria-hidden className={styles.sweep} />
    </Link>
  );
}
