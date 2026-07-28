import { FileText } from "lucide-react";

import styles from "../../scheduled.module.css";
import { safeTranslate } from "../../lib/scheduledView.helpers";

/**
 * Secção dos ficheiros anexados ao agendamento.
 *
 * Não é renderizada quando não existem ficheiros.
 */
export default function ScheduledViewFiles({ translation, files }) {
  if (!files.length) return null;

  return (
    <div className={styles.viewSection}>
      <div className={styles.viewSectionTitle}>
        <FileText aria-hidden />
        <span>{safeTranslate(translation, "ViewModal.files", "Files")}</span>
      </div>

      <div className={styles.fileList}>
        {files.map((file, index) => (
          <a
            key={`${file.url || file.name || index}`}
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className={styles.fileCard}
          >
            <FileText aria-hidden />
            <span>{file.name || file.url || `File ${index + 1}`}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
