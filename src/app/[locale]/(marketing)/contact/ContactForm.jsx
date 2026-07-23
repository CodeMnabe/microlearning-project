"use client";
import { useRef, useState } from "react";
import Script from "next/script";
import { useTranslations } from "next-intl";
import styles from "./contact.module.css";

const INITIAL_FORM = {
  name: "",
  email: "",
  company: "",
  message: "",
};

export default function ContactForm() {
  const t = useTranslations("LandingPage.Contact");
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaElement = useRef(null);
  const widgetId = useRef(null);

  function renderCaptcha() {
    if (!window.turnstile || !captchaElement.current || widgetId.current !== null) return;
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const action = process.env.NEXT_PUBLIC_TURNSTILE_ACTION;
    if (!sitekey || !action) return;
    widgetId.current = window.turnstile.render(captchaElement.current, {
      sitekey,
      action,
      callback: (token) => setCaptchaToken(token),
      "expired-callback": () => setCaptchaToken(""),
      "error-callback": () => setCaptchaToken(""),
    });
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...form, captchaToken }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || t("form.errors.generic"));
      }

      setStatus("success");
      setForm(INITIAL_FORM);
      setCaptchaToken("");
      if (window.turnstile && widgetId.current !== null) {
        window.turnstile.reset(widgetId.current);
      }
    } catch (err) {
      setStatus("error");
      setError(err.message || t("form.errors.generic"));
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderCaptcha}
      />
      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="name" className={styles.label}>
            {t("form.name")}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={updateField}
            placeholder={t("form.namePlaceholder")}
            className={styles.input}
            required
            minLength={2}
            maxLength={120}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>
            {t("form.email")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={updateField}
            placeholder={t("form.emailPlaceholder")}
            className={styles.input}
            required
            maxLength={254}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="company" className={styles.label}>
          {t("form.company")}
        </label>
        <input
          id="company"
          name="company"
          type="text"
          autoComplete="organization"
          value={form.company}
          onChange={updateField}
          placeholder={t("form.companyPlaceholder")}
          className={styles.input}
          maxLength={160}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="message" className={styles.label}>
          {t("form.message")}
        </label>
        <textarea
          id="message"
          name="message"
          value={form.message}
          onChange={updateField}
          placeholder={t("form.messagePlaceholder")}
          className={styles.textarea}
          required
          minLength={10}
          maxLength={4000}
        />
      </div>

      <div ref={captchaElement} />

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={status === "loading" || !captchaToken}
        >
          {status === "loading" ? t("form.sending") : t("form.submit")}
        </button>

        {/* <p className={styles.helper}>{t("form.helper")}</p> */}
      </div>

      {status === "success" ? (
        <p className={styles.success}>{t("form.success")}</p>
      ) : null}

      {status === "error" ? <p className={styles.error}>{error}</p> : null}
    </form>
  );
}
