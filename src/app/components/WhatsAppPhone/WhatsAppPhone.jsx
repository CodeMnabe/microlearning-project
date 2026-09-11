"use client";

import styles from "./whatsAppPhone.module.css";

/**
 * Moldura de telemóvel com o aspeto de uma conversa WhatsApp.
 *
 * Os filhos são as linhas da conversa. Usa WhatsAppBubble para um balão
 * enviado e WhatsAppButton para os botões por baixo do balão.
 */
export default function WhatsAppPhone({
  contactName,
  subtitle = "online",
  compact = false,
  className = "",
  children,
}) {
  const initial = (String(contactName || "").trim()[0] || "U").toUpperCase();

  return (
    <div
      className={`${styles.frame} ${compact ? styles.frameCompact : ""} ${className}`}
      data-testid="whatsapp-phone"
    >
      <div className={styles.header}>
        <div className={styles.avatar}>{initial}</div>
        <div className={styles.headerText}>
          <div className={styles.title}>{contactName || "Contacto"}</div>
          <div className={styles.subtitle}>{subtitle}</div>
        </div>
      </div>

      <div className={styles.chat}>{children}</div>
    </div>
  );
}

export function WhatsAppBubble({ time, className = "", children }) {
  return (
    <div className={styles.rowOut}>
      <div className={`${styles.bubble} ${className}`}>
        {children}
        {time ? <span className={styles.meta}>{time} ✓✓</span> : null}
      </div>
    </div>
  );
}

export function WhatsAppButton({ children, className = "" }) {
  return (
    <div className={styles.rowOut}>
      <div className={`${styles.button} ${className}`}>{children}</div>
    </div>
  );
}
