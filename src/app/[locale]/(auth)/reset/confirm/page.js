"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import styles from "../../login/login.module.css";
import Link from "next/link";

export default function ResetConfirmPage() {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();

  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState("");
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    (async () => {
      // Converts ?code=... into a session cookie
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );
      if (error) {
        setMsg(error.message || t("Auth.resetConfirm.invalid"));
      }
      setReady(true);
    })();
  }, [supabase, t]);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    setStatus("loading");

    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) {
      setStatus("idle");
      setMsg(error.message);
      return;
    }

    setStatus("done");
    setTimeout(() => router.push(`/${locale}/login`), 800);
  }

  if (!ready) {
    return (
      <main className={styles.page}>
        <h1 className={styles.brand}>MyDigitalBot</h1>
        <p className={styles.message} style={{ textAlign: "center" }}>
          {msg || t("Auth.resetConfirm.preparing")}
        </p>
      </main>
    );
  }

  const disabled = status === "loading";

  return (
    <main className={styles.page}>
      <h1 className={styles.brand}>MyDigitalBot</h1>
      <form onSubmit={handleSubmit} className={styles.card}>
        <h1 className={styles.title}>{t("Auth.resetConfirm.title")}</h1>
        <label className={styles.label}>
          {t("Auth.resetConfirm.newPassword")}
        </label>
        <input
          className={styles.input}
          type="password"
          placeholder="••••••••"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          minLength={6}
          required
          disabled={disabled}
        />
        <button
          type="submit"
          className={styles.btnPrimary}
          data-state={status}
          disabled={disabled}
          aria-busy={status === "loading"}
          aria-live="polite"
        >
          <span className={styles.btnLabel}>
            {status === "done"
              ? t("Auth.resetConfirm.updated")
              : t("Auth.resetConfirm.confirm")}
          </span>
          {status === "loading" && (
            <span
              className={styles.spinner}
              role="status"
              aria-label={t("Auth.resetConfirm.updating")}
            />
          )}
        </button>
        <Link href={`/${locale}/login`} className={styles.link}>
          {t("Auth.resetConfirm.back")}
        </Link>
        {msg && <p className={styles.message}>{msg}</p>}
      </form>
    </main>
  );
}
