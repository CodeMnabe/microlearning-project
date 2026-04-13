import { Pencil, Trash2, X } from "lucide-react";
import styles from "../scheduled.module.css";
import { formatDateTime } from "../helpers/scheduled.helpers";

export default function ScheduledViewModal({
  selectedItem,
  translation,
  isViewModalOpen,
  closeViewModal,
  canEditItem,
  openEditModal,
  canDeleteItem,
  handleDelete,
}) {
  return (
    <div
      className={`${styles.modalOverlay} 
      ${isViewModalOpen ? styles.overlayOpen : styles.overlayClosing}`}
      onMouseDown={closeViewModal}
    >
      <div
        className={`${styles.modal} ${styles.viewModal} 
      ${isViewModalOpen ? styles.modalOpen : styles.modalClosing}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.modalHeader}>
          <h2>{translation("ViewModal.title")}</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={closeViewModal}
          >
            <X aria-hidden />
          </button>
        </div>

        <div className={styles.detailGrid}>
          <div>
            <span className={styles.detailLabel}>
              {translation("Table.channel")}
            </span>
            <p>{translation(`Channels.${selectedItem.channel}`)}</p>
          </div>

          <div>
            <span className={styles.detailLabel}>
              {translation("Table.status")}
            </span>
            <p>{translation(`Statuses.${selectedItem.status}`)}</p>
          </div>

          <div>
            <span className={styles.detailLabel}>
              {translation("Table.scheduledFor")}
            </span>
            <p>
              {formatDateTime(selectedItem.scheduledFor, selectedItem.timezone)}
            </p>
          </div>

          <div>
            <span className={styles.detailLabel}>
              {translation("Timezone")}
            </span>
            <p>{selectedItem.timezone || "Europe/Lisbon"}</p>
          </div>

          <div>
            <span className={styles.detailLabel}>
              {translation("Table.recipients")}
            </span>
            <p>{selectedItem.recipientsCount}</p>
          </div>

          <div>
            <span className={styles.detailLabel}>
              {translation("Table.createdBy")}
            </span>
            <p>{selectedItem.createdBy || "-"}</p>
          </div>

          <div>
            <span className={styles.detailLabel}>
              {translation("ViewModal.createdAt")}
            </span>
            <p>{formatDateTime(selectedItem.createdAt)}</p>
          </div>

          <div>
            <span className={styles.detailLabel}>ID</span>
            <p>{selectedItem.id}</p>
          </div>
        </div>

        <div className={styles.messageBox}>
          <span className={styles.detailLabel}>
            {translation("Table.message")}
          </span>
          <p className={styles.fullMessage}>{selectedItem.message || "-"}</p>
        </div>

        <div className={styles.modalFooter}>
          {canEditItem(selectedItem) ? (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                const item = selectedItem;
                closeViewModal();
                setTimeout(() => {
                  openEditModal(item);
                }, 120);
              }}
            >
              <Pencil aria-hidden className={styles.buttonIcon} />
              <span>{translation("Actions.edit")}</span>
            </button>
          ) : null}

          {canDeleteItem(selectedItem) ? (
            <button
              type="button"
              className={styles.deleteButton}
              onClick={() => handleDelete(selectedItem)}
            >
              <Trash2 aria-hidden className={styles.buttonIcon} />
              <span>{translation("Actions.delete")}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
