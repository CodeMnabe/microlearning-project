"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { changePassword } from "./actions";
import styles from "../../login/login.module.css";

export default function ResetConfirmPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();
  const submittingRef = useRef(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle");

  async function handleSubmit(event) {
    event.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    setMessage("");
    setStatus("loading");

    try {
      const result = await changePassword({ password, confirmPassword });

      setPassword("");
      setConfirmPassword("");

      if (!result?.success) {
        setMessage(t("Auth.resetConfirm.genericError"));
        setStatus("idle");
        return;
      }

      setStatus("done");
      router.replace(`/${locale}/login`);
    } catch {
      setPassword("");
      setConfirmPassword("");
      setMessage(t("Auth.resetConfirm.genericError"));
      setStatus("idle");
    } finally {
      submittingRef.current = false;
    }
  }

  const disabled = status === "loading" || status === "done";

  return (
    <main className={styles.page}>
      <h1 className={styles.brand}>MyDigitalBot</h1>
      <form onSubmit={handleSubmit} className={styles.card}>
        <h1 className={styles.title}>{t("Auth.resetConfirm.title")}</h1>

        <p className={styles.message}>{t("Auth.resetConfirm.requirements")}</p>

        <label className={styles.label} htmlFor="password">
          {t("Auth.resetConfirm.newPassword")}
        </label>
        <input
          id="password"
          className={styles.input}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={12}
          maxLength={128}
          required
          disabled={disabled}
        />

        <label className={styles.label} htmlFor="confirmPassword">
          {t("Auth.resetConfirm.confirmPassword")}
        </label>
        <input
          id="confirmPassword"
          className={styles.input}
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          minLength={12}
          maxLength={128}
          required
          disabled={disabled}
        />

        <button
          type="submit"
          className={styles.btnPrimary}
          data-state={status}
          disabled={disabled}
          aria-busy={status === "loading"}
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

        {message && (
          <p className={styles.message} role="alert">
            {message}
          </p>
        )}
      </form>
    </main>
  );
}
