"use client";

import { Loader2 } from "lucide-react";

import styles from "../broadcast.module.css";

/*
 * Faixa por cima da mensagem enquanto o servidor não responde: diz a
 * quantas pessoas se está a enviar (ou agendar) e pede para não fechar.
 */
export default function SendingBanner({ count, deliveryMode, translation }) {
  return (
    <div className={styles.sendingBanner} role="status" aria-live="polite">
      <Loader2 size={18} className={styles.sendingSpinner} aria-hidden="true" />
      <div>
        <div className={styles.sendingBannerTitle}>
          {translation(
            deliveryMode === "schedule"
              ? "Broadcast.schedulingBanner"
              : "Broadcast.sendingBanner",
            { count },
          )}
        </div>
        <div className={styles.sendingBannerHint}>
          {translation("Broadcast.sendingKeepOpen")}
        </div>
      </div>
    </div>
  );
}
