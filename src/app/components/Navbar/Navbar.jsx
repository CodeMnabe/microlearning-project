// src/app/components/Navbar/Navbar.jsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const { user, loading: authLoading, supabase, setUser } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const router = useRouter();
  const pathName = usePathname();
  const [pendingHref, setPendingHref] = useState(null);

  const isAdmin = !!org && org.id === 1;

  // CLEAR optimistic highlight only when the actual route changes
  useEffect(() => {
    setPendingHref(null);
  }, [pathName]); // ← important

  const isActive = useCallback(
    (href) => {
      const current = pendingHref ?? pathName;
      if (href === "/") return current === "/";
      return current === href || current.startsWith(href + "/");
    },
    [pendingHref, pathName]
  );

  const onNavClick = (href) => (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1)
      return;
    setPendingHref(href); // optimistic: highlight immediately
  };

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
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
                <span>Início</span>
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
              <span>Colaboradores</span>
            </Link>

            <Link
              href="/assistants"
              onClick={onNavClick("/assistants")}
              className={`${styles.navItem} ${
                isActive("/assistants") ? styles.active : ""
              }`}
            >
              <Bot aria-hidden className={styles.icon} />
              <span>Assistentes</span>
            </Link>

            <Link
              href="/broadcast"
              onClick={onNavClick("/broadcast")}
              className={`${styles.navItem} ${
                isActive("/broadcast") ? styles.active : ""
              }`}
            >
              <MessageSquare aria-hidden className={styles.icon} />
              <span>Mensagens</span>
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
                <span>Templates</span>
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
                <span>Administração</span>
              </Link>
            )}
          </nav>

          <button
            onClick={handleSignOut}
            className={`${styles.navItem} ${styles.signOut}`}
          >
            <LogOut aria-hidden className={styles.icon} />
            <span>Sair</span>
          </button>
        </>
      ) : (
        <nav className={styles.nav}>
          <Link className={styles.navItem} href="/login">
            <LogIn aria-hidden className={styles.icon} />
            <span>Login</span>
          </Link>
        </nav>
      )}
    </aside>
  );
}
