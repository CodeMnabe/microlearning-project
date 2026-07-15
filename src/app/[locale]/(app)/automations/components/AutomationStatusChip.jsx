import styles from "../automations.module.css";

/**
 * Configuração visual dos estados de uma execução.
 *
 * Cada estado define:
 * - o texto apresentado;
 * - a classe visual adicional.
 */
const STATUS_META = {
  queued: {
    label: "Queued",
    className: styles.chipDark,
  },

  materialized: {
    label: "Materialized",
    className: styles.chip,
  },

  processing: {
    label: "Processing",
    className: styles.chip,
  },

  sent: {
    label: "Sent",
    className: styles.chipSuccess,
  },

  partial: {
    label: "Partial",
    className: styles.chip,
  },

  failed: {
    label: "Failed",
    className: styles.rowActBtnDanger,
  },

  cancelled: {
    label: "Cancelled",
    className: styles.chipDark,
  },

  skipped: {
    label: "Skipped",
    className: styles.chipDark,
  },
};

/**
 * Apresenta o estado visual de um run ou broadcast.
 *
 * @param {{
 *   status?: string | null
 * }} props
 */
export default function AutomationStatusChip({ status }) {
  const statusMeta = STATUS_META[status] || {
    label: status || "-",
    className: styles.chipDark,
  };

  return (
    <span
      className={`${styles.chip} ${statusMeta.className || ""}`}
    >
      {statusMeta.label}
    </span>
  );
}