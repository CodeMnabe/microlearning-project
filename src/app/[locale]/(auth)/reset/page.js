"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  DEFAULT_AUTH_REDIRECT,
  getSafeRedirectPath,
} from "@/lib/auth/safeRedirect";
import { requestPasswordReset } from "./actions";
import styles from "../login/login.module.css"; // reuse spinner/check/btn styles

export default function ResetRequestPage() {
  const searchParams = useSearchParams();
  const t = useTranslations();
  const locale = useLocale();
  const redirectPath = getSafeRedirectPath(
    searchParams.get("next"),
    `/${locale}${DEFAULT_AUTH_REDIRECT}`,
  );

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // 'idle' | 'loading' | 'done'
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setStatus("loading");

    await requestPasswordReset({ email, locale, next: redirectPath });

    setStatus("done"); // label changes to “E-mail enviado”
    setEmail("");
  }

  const disabled = status === "loading";

  return (
    <main className={styles.page}>
      <h1 className={styles.brand}>{t("Auth.brand")}</h1>

      <form onSubmit={handleSubmit} className={styles.card}>
        <h1 className={styles.title}>{t("Auth.reset.title")}</h1>

        <label className={styles.label}>{t("Auth.reset.email")}</label>
        <input
          className={styles.input}
          type="email"
          placeholder={t("Auth.example", { default: "exemplo@exemplo.com" })}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
            {status === "done" ? t("Auth.reset.sent") : t("Auth.reset.send")}
          </span>

          {status === "loading" && (
            <span
              className={styles.spinner}
              role="status"
              aria-label={t("Auth.reset.sending")}
            />
          )}
        </button>

        <Link
          href={`/${locale}/login?next=${encodeURIComponent(redirectPath)}`}
          className={styles.link}
        >
          {t("Auth.reset.back")}
        </Link>

        {errorMsg && <p className={styles.message}>{errorMsg}</p>}
      </form>
    </main>
  );
}
