import { Send } from "lucide-react";

import styles from "../../scheduled.module.css";
import { safeTranslate } from "../../lib/scheduledView.helpers";

/**
 * Secção do template de WhatsApp usado no agendamento.
 *
 * Não é renderizada quando o agendamento não usa template.
 */
export default function ScheduledViewTemplateSection({
  translation,
  template,
}) {
  if (!template) return null;

  return (
    <div className={styles.viewSection}>
      <div className={styles.viewSectionTitle}>
        <Send aria-hidden />
        <span>
          {safeTranslate(
            translation,
            "ViewModal.template",
            "WhatsApp template",
          )}
        </span>
      </div>

      <div className={styles.templateInfoBox}>
        <div>
          <span className={styles.detailLabel}>Name</span>
          <p>{template.name || "-"}</p>
        </div>

        <div>
          <span className={styles.detailLabel}>Project ID</span>
          <p className={styles.monoText}>{template.projectId || "-"}</p>
        </div>

        <div>
          <span className={styles.detailLabel}>Language</span>
          <p>{template.languageCode || "-"}</p>
        </div>
      </div>
    </div>
  );
}
