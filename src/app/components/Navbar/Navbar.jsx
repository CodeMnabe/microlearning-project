// src/app/components/Navbar.js
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import styles from "./navbar.module.css";

export default function Navbar() {
  const { user, loading: authLoading, supabase, setUser } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null); // notify context
    router.push("/login");
  }

  return (
    <nav className={styles.navbar}>
      <Link href="/">Home</Link>

      {/* while auth/org are loading we just don't render user-specific items */}
      {authLoading ? null : user ? (
        <ul className={styles.navLinks}>
          <li>
            {orgLoading ? "…" : org?.name ?? "—"} {/* Org name */}
            {" • "}
            {user.email} {/* Email */}
          </li>

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
              Sign&nbsp;out
            </button>
          </li>
        </ul>
      ) : (
        <ul className={styles.navLinks}>
          <li>
            <Link href="/login">Login</Link>
          </li>
          <li>
            <Link href="/signup">Sign&nbsp;up</Link>
          </li>
        </ul>
      )}
    </nav>
  );
}
