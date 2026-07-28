import { useMemo } from "react";
import { FileText, X } from "lucide-react";

import styles from "../scheduled.module.css";
import {
  buildRecipientRows,
  getFiles,
  getItemPayload,
  getItemResult,
  safeTranslate,
} from "../lib/scheduledView.helpers";

import ScheduledViewDeliverySummary from "./view/ScheduledViewDeliverySummary";
import ScheduledViewFiles from "./view/ScheduledViewFiles";
import ScheduledViewFooter from "./view/ScheduledViewFooter";
import ScheduledViewRecipients from "./view/ScheduledViewRecipients";
import ScheduledViewScheduleSection from "./view/ScheduledViewScheduleSection";
import ScheduledViewSummaryCards from "./view/ScheduledViewSummaryCards";
import ScheduledViewTemplateSection from "./view/ScheduledViewTemplateSection";
import ScheduledViewTrackedLinks from "./view/ScheduledViewTrackedLinks";

/**
 * Modal de visualização de broadcast agendado.
 *
 * Responsável apenas por:
 * - preparar os dados a partir do payload e do resultado;
 * - compor as secções do modal.
 *
 * A preparação dos dados fica em `lib/scheduledView.helpers` e cada secção
 * fica em `components/view/`.
 */
export default function ScheduledViewModal({
  selectedItem,
  orgUsers = [],
  translation,
  isViewModalOpen,
  closeViewModal,
  canEditItem,
  openEditModal,
  canDeleteItem,
  handleDelete,
}) {
  const payload = getItemPayload(selectedItem);
  const result = getItemResult(selectedItem);

  const recipientRows = useMemo(
    () => buildRecipientRows(selectedItem, orgUsers),
    [selectedItem, orgUsers],
  );

  const files = useMemo(() => getFiles(payload), [payload]);

  const trackedLinks = Array.isArray(payload.trackedLinks)
    ? payload.trackedLinks
    : [];

  const recipientCount = recipientRows.length || selectedItem.recipientsCount;

  return (
    <div
      className={`${styles.modalOverlay} ${
        isViewModalOpen ? styles.overlayOpen : styles.overlayClosing
      }`}
      onMouseDown={closeViewModal}
    >
      <div
        className={`${styles.modal} ${styles.viewModal} ${
          isViewModalOpen ? styles.modalOpen : styles.modalClosing
        }`}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.modalHeader}>
          <div>
            <h2>{translation("ViewModal.title")}</h2>
            <p className={styles.modalSubtitle}>
              {safeTranslate(
                translation,
                "ViewModal.subtitle",
                "Full scheduled broadcast information",
              )}
            </p>
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={closeViewModal}
            aria-label="Close"
          >
            <X aria-hidden />
          </button>
        </div>

        <ScheduledViewSummaryCards
          translation={translation}
          item={selectedItem}
          recipientCount={recipientCount}
        />

        <ScheduledViewScheduleSection
          translation={translation}
          item={selectedItem}
        />

        <div className={styles.viewSection}>
          <div className={styles.viewSectionTitle}>
            <FileText aria-hidden />
            <span>{translation("Table.message")}</span>
          </div>

          <div className={styles.messageBox}>
            <p className={styles.fullMessage}>{selectedItem.message || "-"}</p>
          </div>
        </div>

        <ScheduledViewTemplateSection
          translation={translation}
          template={payload.template || null}
        />

        <ScheduledViewRecipients
          translation={translation}
          recipientRows={recipientRows}
          recipientCount={recipientCount}
        />

        <ScheduledViewDeliverySummary
          translation={translation}
          item={selectedItem}
          result={result}
          recipientRows={recipientRows}
        />

        <ScheduledViewTrackedLinks
          translation={translation}
          trackedLinks={trackedLinks}
        />

        <ScheduledViewFiles translation={translation} files={files} />

        <ScheduledViewFooter
          translation={translation}
          item={selectedItem}
          canEditItem={canEditItem}
          openEditModal={openEditModal}
          canDeleteItem={canDeleteItem}
          handleDelete={handleDelete}
          closeViewModal={closeViewModal}
        />
      </div>
    </div>
  );
}
