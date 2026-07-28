"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import styles from "../../login/login.module.css";

export default function MfaEnrollmentPage() {
  const router = useRouter();
  const { locale } = useParams();
  const t = useTranslations("Auth.mfa");
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [qrCode, setQrCode] = useState(null);
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

      if (verified) {
        router.push(`/${locale}/users`);
        return;
      }

      const unverified = totpFactors.find((f) => f.status === "unverified");

      if (unverified) {
        if (unverified.totp?.qr_code) {
          setFactorId(unverified.id);
          setQrCode(unverified.totp.qr_code);
          setLoading(false);
          return;
        } else {
          await supabase.auth.mfa.unenroll({ factorId: unverified.id });
        }
      }

      const { data: enrollData, error: enrollError } =
        await supabase.auth.mfa.enroll({
          factorType: "totp",
        });

      if (enrollError) {
        setError(enrollError.message);
        setLoading(false);
        return;
      }

      setFactorId(enrollData.id);
      setQrCode(enrollData.totp.qr_code);
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
    setTimeout(() => {
      router.push(`/${locale}/users`);
    }, 1000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
  };

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>
            {t("enrollmentTitle", {
              default: "Set up Multi-Factor Authentication",
            })}
          </h1>
          <p style={{ textAlign: "center", color: "var(--ui-muted)" }}>
            {t("preparing", { default: "Preparing enrollment..." })}
          </p>
          <button
            className={styles.btnSecondary}
            onClick={handleLogout}
            style={{ marginTop: "1rem" }}
          >
            {t("logout", { default: "Logout" })}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>
          {t("enrollmentTitle", {
            default: "Set up Multi-Factor Authentication",
          })}
        </h1>

        <p
          style={{
            textAlign: "center",
            fontSize: "0.95rem",
            color: "var(--ink)",
            marginBottom: "0.5rem",
          }}
        >
          {t("scanQrCode", {
            default: "Scan this QR code with your authenticator app:",
          })}
        </p>

        {qrCode && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "1rem",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrCode}
              alt="QR Code for MFA"
              style={{
                width: "200px",
                height: "200px",
                borderRadius: "8px",
                border: "1px solid var(--ui-border)",
              }}
            />
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}
          >
            <label className={styles.label} htmlFor="code">
              {t("enterCode", { default: "Enter the 6-digit code" })}
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
    </main>
  );
}
