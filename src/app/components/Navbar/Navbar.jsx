// src/app/components/Navbar/Navbar.jsx
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import styles from "./navbar.module.css";

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
                Home
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
              Users
            </Link>
            <Link
              className={`${styles.navItem} ${
                activeLink === "/assistants" ? styles.active : ""
              }`}
              href="/assistants"
              onClick={() => setActiveLink("/assistants")}
            >
              Assistants
            </Link>
            <Link
              className={`${styles.navItem} ${
                activeLink === "/broadcast" ? styles.active : ""
              }`}
              href="/broadcast"
              onClick={() => setActiveLink("/broadcast")}
            >
              Mandar Mensagem
            </Link>
            <Link
              className={`${styles.navItem} ${
                activeLink === "/templates" ? styles.active : ""
              }`}
              href="/templates"
              onClick={() => setActiveLink("/templates")}
            >
              Templates
            </Link>
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
          <button onClick={handleSignOut} className={styles.signOut}>
            Sign out
          </button>
        </>
      ) : (
        <nav className={styles.nav}>
          <Link className={styles.navItem} href="/login">
            Login
          </Link>
          <Link className={styles.navItem} href="/signup">
            Sign up
          </Link>
        </nav>
      )}
    </aside>
  );
}
