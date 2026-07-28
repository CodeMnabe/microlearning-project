"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import styles from "../../login/login.module.css";

function getSafeNext(searchParams, locale) {
  const raw = searchParams.get("next");
  if (!raw || typeof raw !== "string") return `/${locale}/users`;
  if (!raw.startsWith("/")) return `/${locale}/users`;
  if (raw.startsWith("//") || raw.includes("\\")) return `/${locale}/users`;
  if (/[\x00-\x1f\x7f]/.test(raw)) return `/${locale}/users`;
  return raw;
}

function MfaChallengeForm() {
  const router = useRouter();
  const { locale } = useParams();
  const searchParams = useSearchParams();
  const t = useTranslations("Auth.mfa");
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push(`/${locale}/login`);
        return;
      }

      const { data: factors, error: factorsError } =
        await supabase.auth.mfa.listFactors();
      if (factorsError) {
        setError(factorsError.message);
        setLoading(false);
        return;
      }

      const totpFactors = factors.totp || [];
      const verified = totpFactors.find((f) => f.status === "verified");

      if (!verified) {
        router.push(`/${locale}/mfa/enrollment`);
        return;
      }

      setFactorId(verified.id);
      setLoading(false);
    }

    init();
  }, [locale, router, supabase]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setStatus("loading");

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });

    if (verifyError) {
      setError(
        t("invalidCode", { default: "Invalid code. Please try again." }),
      );
      setStatus("idle");
      return;
    }

    setStatus("success");
    const nextUrl = getSafeNext(searchParams, locale);

    setTimeout(() => {
      router.push(nextUrl);
    }, 1000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
  };

  if (loading) {
    return (
      <div className={styles.card}>
        <h1 className={styles.title}>
          {t("challengeTitle", { default: "Two-Factor Authentication" })}
        </h1>
        <div
          style={{ display: "flex", justifyContent: "center", padding: "2rem" }}
        >
          <div
            className={styles.spinner}
            style={{
              position: "relative",
              borderTopColor: "var(--brand-1)",
              borderRightColor: "var(--brand-1)",
              borderBottomColor: "var(--ui-border)",
              borderLeftColor: "var(--ui-border)",
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>
        {t("challengeTitle", { default: "Two-Factor Authentication" })}
      </h1>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.9rem",
          marginTop: "0.5rem",
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}
        >
          <label className={styles.label} htmlFor="code">
            {t("enterVerificationCode", {
              default: "Enter the 6-digit verification code",
            })}
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={6}
            required
            className={styles.input}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={status === "loading" || status === "success"}
            placeholder="000000"
          />
        </div>

        {error && <div className={styles.message}>{error}</div>}

        <button
          type="submit"
          className={styles.btnPrimary}
          disabled={
            status === "loading" || status === "success" || code.length < 6
          }
          data-state={status}
        >
          {status === "loading" && <div className={styles.spinner} />}
          {status === "success" && (
            <svg className={styles.check} viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          <span className={styles.btnLabel}>
            {status === "success"
              ? t("verified", { default: "Verified!" })
              : t("verify", { default: "Verify" })}
          </span>
        </button>
      </form>

      <button
        className={styles.btnSecondary}
        onClick={handleLogout}
        style={{ marginTop: "0.5rem" }}
      >
        {t("logout", { default: "Logout" })}
      </button>
    </div>
  );
}

export default function MfaChallengePage() {
  return (
    <main className={styles.page}>
      <Suspense fallback={null}>
        <MfaChallengeForm />
      </Suspense>
    </main>
  );
}
