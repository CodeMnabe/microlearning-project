import { AlertCircle, CheckCircle2, Clock3, Send } from "lucide-react";

import styles from "../../scheduled.module.css";
import { safeTranslate } from "../../lib/scheduledView.helpers";

/**
 * Classe de estilo correspondente ao estado de um destinatário.
 *
 * Fica aqui, e não em `lib`, porque depende do módulo de CSS.
 */
function getStatusClass(status) {
  if (status === "sent") return styles.recipientStatusSent;
  if (status === "failed") return styles.recipientStatusFailed;
  if (status === "partial") return styles.recipientStatusPartial;
  if (status === "sending" || status === "processing") {
    return styles.recipientStatusSending;
  }
  if (status === "cancelled") return styles.recipientStatusCancelled;

  return styles.recipientStatusScheduled;
}

/**
 * Ícone correspondente ao estado de um destinatário.
 *
 * Fica aqui, e não em `lib`, porque devolve JSX.
 */
function getStatusIcon(status) {
  if (status === "sent") return <CheckCircle2 aria-hidden />;
  if (status === "failed") return <AlertCircle aria-hidden />;
  if (status === "sending" || status === "processing") {
    return <Send aria-hidden />;
  }

  return <Clock3 aria-hidden />;
}

/**
 * Cartão de um destinatário no modal de detalhe.
 *
 * Mostra o rótulo, os contactos conhecidos, o estado de entrega, os dados
 * técnicos do envio e o motivo de falha quando existe.
 */
export default function ScheduledRecipientCard({ translation, recipient }) {
  return (
    <div className={styles.recipientCard}>
      <div className={styles.recipientMainRow}>
        <div>
          <strong>{recipient.label}</strong>

          <div className={styles.recipientMeta}>
            {recipient.phoneNumber ? (
              <span>Phone: {recipient.phoneNumber}</span>
            ) : null}

            {recipient.email ? <span>Email: {recipient.email}</span> : null}

            {recipient.whatsappUsername ? (
              <span>WhatsApp: {recipient.whatsappUsername}</span>
            ) : null}

            {recipient.whatsappBsuid ? (
              <span>BSUID: {recipient.whatsappBsuid}</span>
            ) : null}

            {recipient.birdContactId ? (
              <span>Bird contact: {recipient.birdContactId}</span>
            ) : null}

            {recipient.userId ? <span>User ID: {recipient.userId}</span> : null}
          </div>
        </div>

        <span
          className={`${styles.recipientStatus} ${getStatusClass(
            recipient.status,
          )}`}
        >
          {getStatusIcon(recipient.status)}
          <span>
            {safeTranslate(
              translation,
              `Statuses.${recipient.status}`,
              recipient.status,
            )}
          </span>
        </span>
      </div>

      {recipient.kind || recipient.resultStatusCode ? (
        <div className={styles.recipientTechnicalRow}>
          {recipient.kind ? <span>Type: {recipient.kind}</span> : null}

          {recipient.resultStatusCode ? (
            <span>Provider status: {recipient.resultStatusCode}</span>
          ) : null}
        </div>
      ) : null}

      {recipient.reason ? (
        <div className={styles.recipientReason}>{recipient.reason}</div>
      ) : null}
    </div>
  );
}
