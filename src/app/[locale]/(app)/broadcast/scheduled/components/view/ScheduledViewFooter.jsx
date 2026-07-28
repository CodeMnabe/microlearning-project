import { Pencil, Trash2 } from "lucide-react";

import styles from "../../scheduled.module.css";

/**
 * Espera antes de abrir o modal de edição a partir do detalhe.
 *
 * Dá tempo ao modal de detalhe de se fechar, para os dois não aparecerem
 * sobrepostos.
 */
const OPEN_EDIT_DELAY_MS = 120;

/**
 * Rodapé do modal de detalhe, com as ações de editar e eliminar.
 *
 * Cada ação só aparece quando o agendamento a permite.
 */
export default function ScheduledViewFooter({
  translation,
  item,
  canEditItem,
  openEditModal,
  canDeleteItem,
  handleDelete,
  closeViewModal,
}) {
  return (
    <div className={styles.modalFooter}>
      {canEditItem(item) ? (
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            closeViewModal();

            setTimeout(() => {
              openEditModal(item);
            }, OPEN_EDIT_DELAY_MS);
          }}
        >
          <Pencil aria-hidden className={styles.buttonIcon} />
          <span>{translation("Actions.edit")}</span>
        </button>
      ) : null}

      {canDeleteItem(item) ? (
        <button
          type="button"
          className={styles.deleteButton}
          onClick={() => handleDelete(item)}
        >
          <Trash2 aria-hidden className={styles.buttonIcon} />
          <span>{translation("Actions.delete")}</span>
        </button>
      ) : null}
    </div>
  );
}
