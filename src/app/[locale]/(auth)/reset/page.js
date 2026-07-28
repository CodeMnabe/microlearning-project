"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import styles from "../login/login.module.css"; // reuse spinner/check/btn styles
import TurnstileWidget from "@/app/components/TurnstileWidget/TurnstileWidget";
import { requestPasswordReset } from "./actions";

export default function ResetRequestPage() {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const turnstileRef = useRef(null);

  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [status, setStatus] = useState("idle"); // 'idle' | 'loading' | 'done'
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (status === "loading") return; // block double-submit

    setErrorMsg("");
    setStatus("loading");

    const response = await requestPasswordReset({
      email,
      captchaToken,
      locale,
    });

    setCaptchaToken(""); // Clean token after attempt

    if (response?.error) {
      turnstileRef.current?.reset(); // reset on failure
      setStatus("idle");
      if (response.error === "auth_rate_limited") {
        setErrorMsg(
          t("Auth.rateLimited", {
            default: "Muitas tentativas. Tente novamente mais tarde.",
          }),
        );
      } else {
        // generic public response
        setErrorMsg(
          t("Auth.reset.genericError", {
            default: "Ocorreu um erro ao processar o pedido.",
          }),
        );
      }
      return;
    }

    turnstileRef.current?.reset(); // reset on success
    setStatus("done");
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

        <div style={{ margin: "1rem 0" }}>
          <TurnstileWidget
            onVerify={(token) => setCaptchaToken(token)}
            ref={turnstileRef}
          />
        </div>

        <button
          type="submit"
          className={styles.btnPrimary}
          data-state={status}
          disabled={disabled || !captchaToken}
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

        <Link href={`/${locale}/login`} className={styles.link}>
          {t("Auth.reset.back")}
        </Link>

        {errorMsg && <p className={styles.message}>{errorMsg}</p>}
      </form>
    </main>
  );
}
