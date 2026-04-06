"use client";
import { useEffect, useState, useMemo } from "react";
import LoaderLink from "../../(marketing)/components/TopLoader/LoaderLinkr/LoaderLink";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import styles from "./login.module.css";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

export default function LoginPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { startLoading, stopLoading } = useGlobalLoader();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        startLoading();
        router.replace(`/${locale}/users`);
        return;
      }
      stopLoading?.();
    })();
  }, [router, startLoading, stopLoading, locale, supabase]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle"); // 'idle' | 'loading' | 'success'
  const [errorMsg, setErrorMsg] = useState("");

  async function handleAuth(e) {
    e.preventDefault();
    setErrorMsg("");
    setStatus("loading");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus("idle");
      setErrorMsg(error.message);
      return;
    }

    setStatus("success");
    // give the tick a brief moment, then navigate
    setTimeout(() => {
      startLoading?.();
      router.push(`/${locale}/users`);
    }, 650);
  }

  const disabled = status !== "idle";

  return (
    <main className={styles.page}>
      <LoaderLink href="/" className={styles.brand}>
        <Image
          src="/images/Logos/Logo cores.png"
          alt="MyDigitalBot logo"
          width={2047}
          height={276}
          className={styles.logoMark}
          priority
          unoptimized
        />
      </LoaderLink>

      <form className={styles.card} onSubmit={handleAuth}>
        <h1 className={styles.title}>{t("Auth.login.title")}</h1>

        <label className={styles.label} htmlFor="email">
          {t("Auth.login.email")}
        </label>
        <input
          id="email"
          className={styles.input}
          type="email"
          placeholder={t("Auth.example", { default: "exemplo@exemplo.com" })}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={disabled}
        />

        <label className={styles.label} htmlFor="password">
          {t("Auth.login.password")}
        </label>
        <input
          id="password"
          className={styles.input}
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={disabled}
        />

        <button
          type="submit"
          className={styles.btnPrimary}
          data-state={status}
          disabled={disabled}
          aria-live="polite"
        >
          <span className={styles.btnLabel}>{t("Auth.login.login")}</span>

          {status === "loading" && (
            <span
              className={styles.spinner}
              role="status"
              aria-label={t("Auth.login.working")}
            />
          )}

          {status === "success" && (
            <svg
              className={styles.check}
              viewBox="0 0 24 24"
              aria-label={t("Common.ok")}
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <LoaderLink href={`/${locale}/reset`} className={styles.link}>
          {t("Auth.login.forgot")}
        </LoaderLink>

        {errorMsg && <p className={styles.message}>{errorMsg}</p>}
      </form>
    </main>
  );
}
