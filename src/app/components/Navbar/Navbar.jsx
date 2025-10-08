// src/app/components/Navbar/Navbar.jsx
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
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

export default function Navbar() {
  const [activeLink, setActiveLink] = useState(null);
  const { user, loading: authLoading, supabase, setUser } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const router = useRouter();
  const pathName = usePathname();

  const isAdmin = !!org && org.id === 1;

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
  }

  useEffect(() => {
    setActiveLink(pathName);
  }, [pathName]);

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
                className={`${styles.navItem} ${
                  activeLink === "/" ? styles.active : ""
                }`}
                onClick={() => setActiveLink("/")}
              >
                <Home aria-hidden className={styles.icon} />
                <span>Home</span>
              </Link>
            )}
            <Link
              id={1}
              className={`${styles.navItem} ${
                activeLink === "/users" ? styles.active : ""
              }`}
              href="/users"
              onClick={() => setActiveLink("/users")}
            >
              <Users aria-hidden className={styles.icon} />
              <span>Colaboradores</span>
            </Link>
            <Link
              className={`${styles.navItem} ${
                activeLink === "/assistants" ? styles.active : ""
              }`}
              href="/assistants"
              onClick={() => setActiveLink("/assistants")}
            >
              <Bot aria-hidden className={styles.icon} />
              <span>Assistentes</span>
            </Link>
            <Link
              className={`${styles.navItem} ${
                activeLink === "/broadcast" ? styles.active : ""
              }`}
              href="/broadcast"
              onClick={() => setActiveLink("/broadcast")}
            >
              <MessageSquare aria-hidden className={styles.icon} />
              <span>Mensagens</span>
            </Link>
            {isAdmin && (
              <Link
                className={`${styles.navItem} ${
                  activeLink === "/templates" ? styles.active : ""
                }`}
                href="/templates"
                onClick={() => setActiveLink("/templates")}
              >
                <FileText aria-hidden className={styles.icon} />
                <span>Templates</span>
              </Link>
            )}
            {isAdmin && (
              <Link
                className={`${styles.navItem} ${
                  activeLink === "/admin" ? styles.active : ""
                }`}
                href="/admin"
                onClick={() => setActiveLink("/admin")}
              >
                Admin
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
          {/* <Link className={styles.navItem} href="/signup">
            <span>Sign up</span>
          </Link> */}
        </nav>
      )}
    </aside>
  );
}
