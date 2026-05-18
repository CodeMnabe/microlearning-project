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
  ChevronDown,
  SendHorizontal,
  CalendarClock,
  Link2,
  Zap,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useMobileNav } from "@/app/components/MobileNav/MobileNavContext";

export default function Navbar() {
  const translation = useTranslations();
  const { user, loading: authLoading, supabase, setUser } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const router = useRouter();
  const locale = useLocale();
  const pathName = usePathname();

  const { open, close } = useMobileNav();

  const pathNoLocale = pathName.replace(/^\/(en|pt)(?=\/|$)/, "") || "/";
  const [pendingHref, setPendingHref] = useState(null);
  const isAdmin = !!org && org.id === 1;

  const isActive = useCallback(
    (href) => {
      const current = pendingHref ?? pathNoLocale;
      if (href === "/") return current === "/";
      return current === href || current.startsWith(href + "/");
    },
    [pendingHref, pathNoLocale],
  );

  const isExactActive = useCallback(
    (href) => {
      const current = pendingHref ?? pathNoLocale;
      return current === href;
    },
    [pendingHref, pathNoLocale],
  );

  const broadcastSectionActive = isActive("/broadcast");
  const [broadcastOpen, setBroadcastOpen] = useState(broadcastSectionActive);

  useEffect(() => setPendingHref(null), [pathName]);
  useEffect(() => close(), [pathName]);

  useEffect(() => {
    if (broadcastSectionActive) {
      setBroadcastOpen(true);
    }
  }, [broadcastSectionActive]);

  const onNavClick = (href) => (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1)
      return;
    setPendingHref(href);
    close();
  };

  async function handleSignOut() {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {}

    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
          localStorage.removeItem(k);
        }
        if (k.startsWith("sb-") && k.endsWith("-refresh-token")) {
          localStorage.removeItem(k);
        }
      }

      try {
        const bc = new BroadcastChannel("supabase.auth");
        bc.postMessage({ event: "SIGNED_OUT" });
        bc.close();
      } catch {}
    } catch {}

    await fetch("/api/auth/signout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    });

    setUser(null);
    router.replace("/login");
    window.location.assign(`/${locale}/login`);
  }

  return (
    <>
      <aside
        id="primary-nav"
        className={`${styles.sidebar} ${open ? styles.open : ""}`}
        aria-hidden={open ? "false" : "true"}
        aria-label="Main navigation"
      >
        {!authLoading && user ? (
          <>
            <div className={styles.userBlock}>
              <div className={styles.orgLine}>
                {orgLoading ? "…" : (org?.name ?? "—")}
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
                href="/automations"
                onClick={onNavClick("/automations")}
                className={`${styles.navItem} ${
                  isActive("/automations") ? styles.active : ""
                }`}
              >
                <Zap aria-hidden className={styles.icon} />
                <span>Automations</span>
              </Link>

              <div className={styles.group}>
                <button
                  type="button"
                  className={`${styles.navItem} ${styles.navToggle} ${
                    broadcastSectionActive ? styles.active : ""
                  }`}
                  onClick={() => setBroadcastOpen((prev) => !prev)}
                  aria-expanded={broadcastOpen}
                  aria-controls="broadcast-subnav"
                >
                  <span className={styles.navItemMain}>
                    <MessageSquare aria-hidden className={styles.icon} />
                    <span>{translation("Nav.broadcast")}</span>
                  </span>

                  <ChevronDown
                    aria-hidden
                    className={`${styles.chevron} ${
                      broadcastOpen ? styles.chevronOpen : ""
                    }`}
                  />
                </button>

                {broadcastOpen && (
                  <div id="broadcast-subnav" className={styles.subnav}>
                    <Link
                      href="/broadcast"
                      onClick={onNavClick("/broadcast")}
                      className={`${styles.subnavItem} ${
                        isExactActive("/broadcast") ? styles.active : ""
                      }`}
                    >
                      <SendHorizontal
                        aria-hidden
                        className={styles.subnavIcon}
                      />
                      <span>{translation("Nav.broadcastCreate")}</span>
                    </Link>

                    <Link
                      href="/broadcast/scheduled"
                      onClick={onNavClick("/broadcast/scheduled")}
                      className={`${styles.subnavItem} ${
                        isActive("/broadcast/scheduled") ? styles.active : ""
                      }`}
                    >
                      <CalendarClock
                        aria-hidden
                        className={styles.subnavIcon}
                      />
                      <span>{translation("Nav.broadcastScheduled")}</span>
                    </Link>

                    <Link
                      href="/broadcast/tracked-links"
                      onClick={onNavClick("/broadcast/tracked-links")}
                      className={`${styles.subnavItem} ${
                        isActive("/broadcast/tracked-links")
                          ? styles.active
                          : ""
                      }`}
                    >
                      <Link2 aria-hidden className={styles.subnavIcon} />
                      <span>{translation("Nav.trackedLinks")}</span>
                    </Link>
                  </div>
                )}
              </div>

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

            <Link
              href="/options"
              onClick={onNavClick("/options")}
              className={`${styles.navItem} ${styles.options}`}
            >
              <Settings aria-hidden className={styles.icon} />
              <span>{translation("Nav.options")}</span>
            </Link>

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
            <Link
              className={styles.navItem}
              href="/login"
              onClick={() => close()}
            >
              <LogIn aria-hidden className={styles.icon} />
              <span>{translation("Nav.login")}</span>
            </Link>
          </nav>
        )}
      </aside>

      <button
        className={styles.backdrop}
        hidden={!open}
        aria-hidden="true"
        tabIndex={-1}
        onClick={close}
      />
    </>
  );
}
