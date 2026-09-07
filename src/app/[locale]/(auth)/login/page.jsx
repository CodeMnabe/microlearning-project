"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import LoaderLink from "../../(marketing)/components/TopLoader/LoaderLink";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import styles from "./login.module.css";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Check, Globe } from "lucide-react";
import { localeOptions } from "@/i18n/localeMeta";

function LoginLanguageMenu({ locale }) {
  const t = useTranslations("Lang");
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();
  const activeOption =
    localeOptions.find((option) => option.code === locale) ?? localeOptions[0];

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !rootRef.current) return;
    const items = rootRef.current.querySelectorAll('[role="menuitem"]');
    const activeIndex = localeOptions.findIndex(
      (option) => option.code === locale,
    );
    items[activeIndex >= 0 ? activeIndex : 0]?.focus();
  }, [open, locale]);

  function focusItemAt(index) {
    const items = Array.from(
      rootRef.current?.querySelectorAll('[role="menuitem"]') ?? [],
    );
    if (!items.length) return;
    items[(index + items.length) % items.length]?.focus();
  }

  function handleTriggerKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
    }
  }

  function handleItemKeyDown(event, index) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItemAt(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItemAt(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItemAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItemAt(localeOptions.length - 1);
    }
  }

  function handleBlur(event) {
    if (!rootRef.current?.contains(event.relatedTarget)) {
      setOpen(false);
    }
  }

  return (
    <div
      className={styles.languageRoot}
      ref={rootRef}
      onBlur={handleBlur}
    >
      <button
        type="button"
        ref={triggerRef}
        className={styles.languageTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t("triggerLabel", { language: activeOption.label })}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <Globe size={18} aria-hidden="true" />
        <span className={styles.languageCode} aria-hidden="true">
          {activeOption.short}
        </span>
      </button>

      <div
        id={menuId}
        role="menu"
        className={styles.languageMenu}
        aria-label={t("ariaLabel")}
        data-open={open || undefined}
      >
        {localeOptions.map((option, index) => {
          const isActive = option.code === locale;

          return (
            <LoaderLink
              key={option.code}
              role="menuitem"
              href="/login"
              locale={option.code}
              prefetch={false}
              tabIndex={open ? undefined : -1}
              aria-current={isActive ? "true" : undefined}
              aria-label={t("switchTo", { code: option.label })}
              className={`${styles.languageItem} ${
                isActive ? styles.languageItemActive : ""
              }`}
              onClick={() => setOpen(false)}
              onKeyDown={(event) => handleItemKeyDown(event, index)}
            >
              <span className={styles.languageCheck} aria-hidden="true">
                {isActive ? <Check size={15} /> : null}
              </span>
              <span className={styles.languageLabel}>{option.label}</span>
              <span className={styles.languageShort} aria-hidden="true">
                {option.short}
              </span>
            </LoaderLink>
          );
        })}
      </div>
    </div>
  );
}

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
    <main id="login-page" className={styles.page}>
      <div className={styles.loginLanguage}>
        <LoginLanguageMenu locale={locale} />
      </div>

      <div className={styles.brandMotif} aria-hidden="true">
        <svg viewBox="34 26 405 267" focusable="false">
          <path d="M384.9,188.75c20.55-29.6,32.69-65.47,32.69-104.16,0-2.42-.14-4.81-.3-7.19l-.14-2.05-54.48,2.9.17,2.85c.09,1.16.18,2.32.18,3.5,0,70.91-57.69,128.61-128.6,128.61S105.82,155.5,105.82,84.59c0-1.11.1-2.2.17-3.29l.19-3.16-54.5-2.67-.14,2.15c-.15,2.31-.29,4.62-.29,6.98,0,101,82.17,183.17,183.17,183.17,39.51,0,76.04-12.71,106-34.07l66.12,29.21-21.65-74.14Z" />
          <path d="M173.49,98.62c10.39,0,19.79,4.18,26.67,10.91,7.09-6.93,11.52-16.58,11.52-27.28,0-21.09-17.1-38.19-38.19-38.19s-38.19,17.1-38.19,38.19c0,10.7,4.43,20.35,11.52,27.28,6.89-6.73,16.28-10.91,26.67-10.91Z" />
          <path
            d="M173.49,98.62c10.39,0,19.79,4.18,26.67,10.91,7.09-6.93,11.52-16.58,11.52-27.28,0-21.09-17.1-38.19-38.19-38.19s-38.19,17.1-38.19,38.19c0,10.7,4.43,20.35,11.52,27.28,6.89-6.73,16.28-10.91,26.67-10.91Z"
            transform="translate(118.05 0)"
          />
        </svg>
      </div>

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
