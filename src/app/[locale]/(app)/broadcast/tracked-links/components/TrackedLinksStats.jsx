import styles from "../tracked-links.module.css";

export default function TrackedLinksStats({ translation, totalLinks }) {
  return (
    <div className={styles.stats}>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>{translation("TrackedLinks.totalLinks")}</div>
        <div className={styles.statValue}>{totalLinks}</div>
      </div>
    </div>
  );
}
