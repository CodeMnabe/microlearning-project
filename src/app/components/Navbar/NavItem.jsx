"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import styles from "./navbar.module.css";

export default function NavItem({ href, children }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  const [clicked, setClicked] = useState(false);

  function playSweep() {
    // restart animation if clicked repeatedly
    setClicked(false);
    requestAnimationFrame(() => setClicked(true));
  }

  return (
    <Link
      href={href}
      onClick={playSweep} // Link supports onClick
      className={[
        styles.navItem,
        isActive ? styles.active : "",
        clicked ? styles.clicked : "",
      ].join(" ")}
    >
      <span className={styles.label}>{children}</span>
      <span aria-hidden className={styles.sweep} />
    </Link>
  );
}
