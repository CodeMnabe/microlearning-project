import styles from "../analytics.module.css";

import DescriptionInfo from "./DescriptionInfo";

export default function FullLinksModal({
  isOpen,
  onClose,
  title,
  description,
  closeLabel,
  linkLabel,
  clicksLabel,
  rows,
  format,
}) {
  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <section
        className={styles.linksModal}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.linksModalHeader}>
          <div className={styles.titleWithInfo}>
            <h2 className={styles.sectionTitle}>{title}</h2>
            <DescriptionInfo text={description} />
          </div>

          <button
            type="button"
            className={styles.modalCloseButton}
            onClick={onClose}
          >
            {closeLabel}
          </button>
        </div>

        <div className={styles.fullLinksTableWrapper}>
          <table className={styles.rankingTable}>
            <thead>
              <tr>
                <th>#</th>
                <th>{linkLabel}</th>
                <th>{clicksLabel}</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id || index}>
                  <td>
                    <span className={styles.rankingPosition}>
                      {index + 1}
                    </span>
                  </td>

                  <td>
                    <span className={styles.rankingMainText}>
                      {row.label}
                    </span>
                  </td>

                  <td>{format(row.clicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}