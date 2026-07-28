import { CheckCircle2 } from "lucide-react";

import styles from "../../scheduled.module.css";
import { safeTranslate } from "../../lib/scheduledView.helpers";

/**
 * Resumo de entrega do agendamento.
 *
 * As contagens vêm do resultado do envio quando existe; caso contrário são
 * calculadas a partir do estado de cada destinatário.
 *
 * A secção não é renderizada enquanto não houver nada para mostrar.
 */
export default function ScheduledViewDeliverySummary({
  translation,
  item,
  result,
  recipientRows,
}) {
  const okCount =
    Number(result.ok) ||
    recipientRows.filter((recipient) => recipient.status === "sent").length;

  const failedCount =
    Number(result.failed) ||
    recipientRows.filter((recipient) => recipient.status === "failed").length;

  const hasDeliverySummary =
    item?.status === "sent" ||
    item?.status === "partial" ||
    item?.status === "failed" ||
    okCount > 0 ||
    failedCount > 0 ||
    item?.lastError ||
    result.error;

  if (!hasDeliverySummary) return null;

  return (
    <div className={styles.viewSection}>
      <div className={styles.viewSectionTitle}>
        <CheckCircle2 aria-hidden />
        <span>
          {safeTranslate(
            translation,
            "ViewModal.deliverySummary",
            "Delivery summary",
          )}
        </span>
      </div>

      <div className={styles.deliverySummary}>
        <div>
          <span>{safeTranslate(translation, "Common.success", "Success")}</span>
          <strong>{okCount}</strong>
        </div>

        <div>
          <span>{safeTranslate(translation, "Common.failed", "Failed")}</span>
          <strong>{failedCount}</strong>
        </div>

        <div>
          <span>{safeTranslate(translation, "Table.status", "Status")}</span>
          <strong>{translation(`Statuses.${item.status}`)}</strong>
        </div>
      </div>

      {item.lastError || result.error ? (
        <div className={styles.deliveryErrorBox}>
          {item.lastError || result.error}
        </div>
      ) : null}
    </div>
  );
}
