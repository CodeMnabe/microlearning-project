// src/app/components/Navbar.js  (or move it wherever you keep shared UI)
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./navbar.module.css";
import { useAuth } from "@/app/AuthContext";

export default function Navbar() {
  const { user, loading, supabase } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(false);
    router.push("/login");
  }

  return (
    <nav className={styles.navbar}>
      <Link href="/">Home</Link>

      {loading ? null : user ? (
        <ul className={styles.navLinks}>
          <li>
            <Link href="/users">Users</Link>
          </li>
          <li>
            <Link href="/assistants">Assistants</Link>
          </li>
          <li>
            <Link href="/admin">Admin</Link>
          </li>
          <li>
            <button onClick={handleSignOut} className={styles.linkButton}>
              Sign out
            </button>
          </li>
        </ul>
      ) : (
        <ul className={styles.navLinks}>
          <li>
            <Link href="/login">Login</Link>
          </li>
          <li>
            <Link href="/signup">Sign up</Link>
          </li>
        </ul>
      )}
    </nav>
  );
}
