// src/app/components/Navbar/Navbar.jsx
"use client";

import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import styles from "./navbar.module.css";
import {
  Home,
  Users,
  Bot,
  MessageSquare,
  FileText,
  Settings,
  LogOut,
  LogIn,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";

export default function Navbar() {
  const translation = useTranslations();
  const { user, loading: authLoading, supabase, setUser } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const router = useRouter();
  const locale = useLocale();
  const pathName = usePathname();

  const pathNoLocale = pathName.replace(/^\/(en|pt)(?=\/|$)/, "") || "/";
  const [pendingHref, setPendingHref] = useState(null);
  const isAdmin = !!org && org.id === 1;

  useEffect(() => setPendingHref(null), [pathName]);

  const isActive = useCallback(
    (href) => {
      const current = pendingHref ?? pathNoLocale;
      if (href === "/") return current === "/";
      return current === href || current.startsWith(href + "/");
    },
    [pendingHref, pathNoLocale]
  );

  const onNavClick = (href) => (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1)
      return;
    setPendingHref(href);
  };

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    router.push(`/login`);
  }

  return (
    <aside className={styles.sidebar}>
      {!authLoading && user ? (
        <>
          <div className={styles.userBlock}>
            <div className={styles.orgLine}>
              {orgLoading ? "…" : org?.name ?? "—"}
            </div>
            <div className={styles.emailLine}>{user.email}</div>
          </div>

          <nav className={styles.nav}>
            {isAdmin && (
              <Link
                href="/"
                onClick={onNavClick("/")}
                className={`${styles.navItem} ${
                  isActive("/") ? styles.active : ""
                }`}
              >
                <Home aria-hidden className={styles.icon} />
                <span>{translation("Nav.home")}</span>
              </Link>
            )}

            <Link
              href="/users"
              onClick={onNavClick("/users")}
              className={`${styles.navItem} ${
                isActive("/users") ? styles.active : ""
              }`}
            >
              <Users aria-hidden className={styles.icon} />
              <span>{translation("Nav.users")}</span>
            </Link>

            <Link
              href="/assistants"
              onClick={onNavClick("/assistants")}
              className={`${styles.navItem} ${
                isActive("/assistants") ? styles.active : ""
              }`}
            >
              <Bot aria-hidden className={styles.icon} />
              <span>{translation("Nav.assistants")}</span>
            </Link>

            <Link
              href="/broadcast"
              onClick={onNavClick("/broadcast")}
              className={`${styles.navItem} ${
                isActive("/broadcast") ? styles.active : ""
              }`}
            >
              <MessageSquare aria-hidden className={styles.icon} />
              <span>{translation("Nav.broadcast")}</span>
            </Link>

            {isAdmin && (
              <Link
                href="/templates"
                onClick={onNavClick("/templates")}
                className={`${styles.navItem} ${
                  isActive("/templates") ? styles.active : ""
                }`}
              >
                <FileText aria-hidden className={styles.icon} />
                <span>{translation("Nav.templates")}</span>
              </Link>
            )}

            {isAdmin && (
              <Link
                href="/admin"
                onClick={onNavClick("/admin")}
                className={`${styles.navItem} ${
                  isActive("/admin") ? styles.active : ""
                }`}
              >
                <Settings aria-hidden className={styles.icon} />
                <span>{translation("Nav.admin")}</span>
              </Link>
            )}
          </nav>

          <button
            onClick={handleSignOut}
            className={`${styles.navItem} ${styles.signOut}`}
          >
            <LogOut aria-hidden className={styles.icon} />
            <span>{translation("Nav.logout")}</span>
          </button>
        </>
      ) : (
        <nav className={styles.nav}>
          <Link className={styles.navItem} href="/login">
            <LogIn aria-hidden className={styles.icon} />
            <span>{translation("Nav.login")}</span>
          </Link>
        </nav>
      )}
    </aside>
  );
}
