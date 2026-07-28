"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import styles from "./turnstileWidget.module.css";

export default function TurnstileWidget({
  onVerify,
  onExpire,
  onError,
  resetTrigger = 0,
  action,
}) {
  const captchaElement = useRef(null);
  const widgetId = useRef(null);

  function renderCaptcha() {
    if (
      !window.turnstile ||
      !captchaElement.current ||
      widgetId.current !== null
    )
      return;

    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const finalAction = action || process.env.NEXT_PUBLIC_TURNSTILE_AUTH_ACTION;

    if (!sitekey || !finalAction) return;

    widgetId.current = window.turnstile.render(captchaElement.current, {
      sitekey,
      action: finalAction,
      callback: (token) => onVerify?.(token),
      "expired-callback": () => onExpire?.(),
      "error-callback": () => onError?.(),
    });
  }

  useEffect(() => {
    if (window.turnstile && widgetId.current !== null && resetTrigger > 0) {
      window.turnstile.reset(widgetId.current);
    }
  }, [resetTrigger]);

  useEffect(() => {
    return () => {
      if (window.turnstile && widgetId.current !== null) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, []);

  return (
    <div className={styles.container}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderCaptcha}
      />
      <div ref={captchaElement} />
    </div>
  );
}
