import styles from "../analytics.module.css";


/**
 * Card reutilizável para mostrar uma métrica individual.
 */
export default function MetricCard({
  icon: Icon,
  title,
  value,
  description,
  tone = "default",
}) {
  return (
    <article className={`${styles.card} ${styles[tone] || ""}`}>
      <div className={styles.cardIcon}>
        <Icon size={20} />
      </div>

      <div>
        <div className={styles.cardLabel}>{title}</div>
        <div className={styles.cardValue}>{value}</div>

        {description && <div className={styles.cardHelper}>{description}</div>}
      </div>
    </article>
  );
}