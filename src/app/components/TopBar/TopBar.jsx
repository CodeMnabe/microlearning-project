// src/app/components/TopBar/TopBar.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import styles from "./topbar.module.css";
import LanguageSwitch from "./LanguageSwitch";
import { Menu, X } from "lucide-react";
import { useMobileNav } from "../MobileNav/MobileNavContext";

function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

export default function TopBar() {
  const { user } = useAuth();
  const { org } = useOrganization(user);
  const router = useRouter();
  const pathname = usePathname();

  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  const { open, toggle } = useMobileNav();

  function onSubmit(e) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  useEffect(() => setQ(""), [pathname]);

  const logoUrl = org?.logo_url;
  const orgName = org?.name ?? "—";

  return (
    <header className={styles.topbar} role="banner">
      <div className={styles.inner}>
        <button
          className={styles.hamburger}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-controls="primary-nav"
          aria-expanded={open ? "true" : "false"}
          onClick={toggle}
        >
          {open ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>
        <h1 className={styles.brand}>MyDigitalBot</h1>

        {/* RIGHT SIDE (pushes to the far right) */}
        <div className={styles.right}>
          {/* put other right-side controls here later if you want */}
          <LanguageSwitch />
        </div>
      </div>
    </header>
  );
}
