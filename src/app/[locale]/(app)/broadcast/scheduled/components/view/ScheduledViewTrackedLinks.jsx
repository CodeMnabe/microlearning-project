import { Link2 } from "lucide-react";

import styles from "../../scheduled.module.css";
import { safeTranslate } from "../../lib/scheduledView.helpers";

/**
 * Secção dos links rastreados incluídos na mensagem.
 *
 * Não é renderizada quando o agendamento não tem links.
 */
export default function ScheduledViewTrackedLinks({
  translation,
  trackedLinks,
}) {
  if (!trackedLinks.length) return null;

  return (
    <div className={styles.viewSection}>
      <div className={styles.viewSectionTitle}>
        <Link2 aria-hidden />
        <span>
          {safeTranslate(
            translation,
            "ViewModal.trackedLinks",
            "Tracked links",
          )}
        </span>
      </div>

      <div className={styles.linkList}>
        {trackedLinks.map((link, index) => (
          <div key={`${link.key || index}`} className={styles.linkCard}>
            <strong>{link.label || link.key || `Link ${index + 1}`}</strong>
            <span className={styles.monoText}>
              {"{{link."}
              {link.key}
              {"}}"}
            </span>
            <p>{link.destinationUrl || "-"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
