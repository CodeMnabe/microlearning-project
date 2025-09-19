// src/app/components/TopBar/TopBar.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import styles from "./topbar.module.css";

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
  const { org, loading } = useOrganization(user);
  const router = useRouter();
  const pathname = usePathname();

  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  function onSubmit(e) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/") return;
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        document.activeElement?.isContentEditable
      )
        return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setQ(""), [pathname]);

  const logoUrl = org?.logo_url;
  const orgName = org?.name ?? "—";

  return (
    <header className={styles.topbar} role="banner">
      <div className={styles.inner}>
        <div className={styles.brand}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${orgName} logo`}
              className={styles.logo}
            />
          ) : (
            <div className={styles.logoFallback} aria-hidden="true">
              {initials(orgName)}
            </div>
          )}
        </div>

        <form className={styles.search} onSubmit={onSubmit} role="search">
          <div className={styles.searchBox}>
            <span className={styles.searchIcon} aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <circle cx="11" cy="11" r="7" strokeWidth="2"></circle>
                <line
                  x1="21"
                  y1="21"
                  x2="16.65"
                  y2="16.65"
                  strokeWidth="2"
                ></line>
              </svg>
            </span>
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…  ( / to focus )"
              className={styles.input}
              aria-label="Search"
              autoComplete="off"
            />
            <button type="submit" className={styles.searchBtn}>
              Go
            </button>
          </div>
        </form>
      </div>
    </header>
  );
}
