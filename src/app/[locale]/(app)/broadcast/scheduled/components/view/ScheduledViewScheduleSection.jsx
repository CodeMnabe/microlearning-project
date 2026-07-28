import { Clock3 } from "lucide-react";

import styles from "../../scheduled.module.css";
import { formatDateTime } from "../../lib/scheduled.helpers";
import { safeTranslate } from "../../lib/scheduledView.helpers";

/**
 * Secção com os dados de agendamento: data prevista, timezone,
 * criação e identificador.
 */
export default function ScheduledViewScheduleSection({ translation, item }) {
  return (
    <div className={styles.viewSection}>
      <div className={styles.viewSectionTitle}>
        <Clock3 aria-hidden />
        <span>
          {safeTranslate(translation, "ViewModal.scheduleInfo", "Schedule")}
        </span>
      </div>

      <div className={styles.detailGrid}>
        <div>
          <span className={styles.detailLabel}>
            {translation("Table.scheduledFor")}
          </span>
          <p>{formatDateTime(item.scheduledFor, item.timezone)}</p>
        </div>

        <div>
          <span className={styles.detailLabel}>{translation("Timezone")}</span>
          <p>{item.timezone || "Europe/Lisbon"}</p>
        </div>

        <div>
          <span className={styles.detailLabel}>
            {translation("ViewModal.createdAt")}
          </span>
          <p>{formatDateTime(item.createdAt)}</p>
        </div>

        <div>
          <span className={styles.detailLabel}>
            {translation("Table.createdBy")}
          </span>
          <p>{item.createdBy || "-"}</p>
        </div>

        <div className={styles.detailGridWide}>
          <span className={styles.detailLabel}>ID</span>
          <p className={styles.monoText}>{item.id}</p>
        </div>
      </div>
    </div>
  );
}
