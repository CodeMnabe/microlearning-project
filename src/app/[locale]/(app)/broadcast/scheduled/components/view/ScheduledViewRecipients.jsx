import { Users } from "lucide-react";

import styles from "../../scheduled.module.css";
import { safeTranslate } from "../../lib/scheduledView.helpers";

import ScheduledRecipientCard from "./ScheduledRecipientCard";

/**
 * Secção de destinatários do modal de detalhe.
 *
 * Quando o agendamento não guardou destinatários, apresenta uma caixa
 * a explicar que não existem dados.
 */
export default function ScheduledViewRecipients({
  translation,
  recipientRows,
  recipientCount,
}) {
  return (
    <div className={styles.viewSection}>
      <div className={styles.viewSectionHeader}>
        <div className={styles.viewSectionTitle}>
          <Users aria-hidden />
          <span>
            {safeTranslate(translation, "ViewModal.recipients", "Recipients")}
          </span>
        </div>

        <span className={styles.sectionCount}>{recipientCount}</span>
      </div>

      {recipientRows.length ? (
        <div className={styles.recipientsList}>
          {recipientRows.map((recipient) => (
            <ScheduledRecipientCard
              key={recipient.id}
              translation={translation}
              recipient={recipient}
            />
          ))}
        </div>
      ) : (
        <div className={styles.emptyDetailBox}>
          {safeTranslate(
            translation,
            "ViewModal.noRecipients",
            "No recipient details were saved in this scheduled broadcast.",
          )}
        </div>
      )}
    </div>
  );
}
