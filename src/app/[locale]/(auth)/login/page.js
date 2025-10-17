"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import styles from "./login.module.css";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const supabase = createClient();
  const { startLoading, stopLoading } = useGlobalLoader();

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        console.log(session);
        startLoading();
        router.replace("/users");
        return;
      }
      stopLoading?.();
    })();
  }, [supabase, router, startLoading, stopLoading]);

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
      setErrorMsg(error.message); // optional (or remove if you don't want any text)
      return;
    }

    setStatus("success");
    // give the tick a brief moment, then navigate
    setTimeout(() => {
      startLoading?.();
      router.push("/users");
    }, 650);
  }

  const disabled = status !== "idle";

  return (
    <main className={styles.page}>
      <h1 className={styles.brand}>MyDigitalBot</h1>

      <form className={styles.card} onSubmit={handleAuth}>
        <h1 className={styles.title}>{t("Auth.login.title")}</h1>

        <label className={styles.label}>{t("Auth.login.email")}</label>
        <input
          className={styles.input}
          type="email"
          placeholder={t("Auth.example", { default: "exemplo@exemplo.com" })}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={disabled}
        />

        <label className={styles.label}>{t("Auth.login.password")}</label>
        <input
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

        <a href="/reset" className={styles.link}>
          {t("Auth.login.forgot")}
        </a>

        {/* Optional: keep error text if you want it */}
        {errorMsg && <p className={styles.message}>{errorMsg}</p>}
      </form>
    </main>
  );
}
