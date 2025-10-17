"use client";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import styles from "../login/login.module.css"; // reuses spinner/check/btn styles

export default function ResetRequestPage() {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // 'idle' | 'loading' | 'done'
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setStatus("loading");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/${locale}/reset/confirm`,
      flowType: "implicit",
    });

    if (error) {
      setStatus("idle");
      setErrorMsg(error.message);
      return;
    }

    setStatus("done"); // label changes to “E-mail sent” (localized)
    setEmail("");
  }

  const disabled = status === "loading";

  return (
    <main className={styles.page}>
      <h1 className={styles.brand}>MyDigitalBot</h1>

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
          data-state={status} // CSS hides label only during 'loading'
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

        <a href="/login" className={styles.link}>
          {t("Auth.reset.back")}
        </a>

        {errorMsg && <p className={styles.message}>{errorMsg}</p>}
      </form>
    </main>
  );
}
