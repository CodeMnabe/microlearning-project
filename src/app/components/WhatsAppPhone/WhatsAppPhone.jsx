"use client";

import styles from "./whatsAppPhone.module.css";

/**
 * Moldura de telemóvel com o aspeto de uma conversa WhatsApp (ou Teams, com
 * `variant="teams"`).
 *
 * Os filhos são as linhas da conversa. Usa WhatsAppBubble para um balão
 * enviado e WhatsAppButton para os botões por baixo do balão. `footer` é a
 * barra inferior, onde no WhatsApp fica a caixa de escrita.
 */
export default function WhatsAppPhone({
  contactName,
  subtitle = "online",
  compact = false,
  variant = "whatsapp",
  className = "",
  footer = null,
  children,
}) {
  const initial = (String(contactName || "").trim()[0] || "U").toUpperCase();

  const classes = [
    styles.frame,
    compact ? styles.frameCompact : "",
    variant === "teams" ? styles.frameTeams : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} data-testid="whatsapp-phone">
      <div className={styles.header}>
        <div className={styles.avatar}>{initial}</div>
        <div className={styles.headerText}>
          <div className={styles.title}>{contactName || "Contacto"}</div>
          <div className={styles.subtitle}>{subtitle}</div>
        </div>
      </div>

      <div className={styles.chat}>{children}</div>

      {footer ? <div className={styles.bar}>{footer}</div> : null}
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
