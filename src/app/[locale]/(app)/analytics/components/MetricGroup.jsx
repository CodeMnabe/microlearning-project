import styles from "../analytics.module.css";

import DescriptionInfo from "./DescriptionInfo";


/**
 * Grupo reutilizável de cards de métricas.
 * Permite mostrar ou ocultar um conjunto de cards.
 */
export default function MetricGroup({
  title,
  description,
  children,
  isVisible = true,
  onToggle,
  showLabel,
  hideLabel,
  className = "",
}) {
  return (
    <section
      className={`${styles.metricGroup} ${className} ${
        !isVisible ? styles.metricGroupCollapsed : ""
      }`}
    >
      <div className={styles.metricGroupHeader}>
        <div className={styles.titleWithInfo}>
          <h2 className={styles.metricGroupTitle}>{title}</h2>
          <DescriptionInfo text={description} />
        </div>

        {onToggle && (
          <button
            type="button"
            className={styles.metricGroupToggle}
            onClick={onToggle}
          >
            {isVisible ? hideLabel : showLabel}
          </button>
        )}
      </div>

      {isVisible && <div className={styles.metricGroupGrid}>{children}</div>}
    </section>
  );
}