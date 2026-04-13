import styles from "../scheduled.module.css";

export default function ScheduledStats({ translation, stats }) {
  return (
    <div className={styles.statsGrid}>
      <article className={styles.statCard}>
        <span className={styles.statLabel}>{translation("Stats.total")}</span>
        <strong className={styles.statValue}>{stats.total}</strong>
      </article>

      <article className={styles.statCard}>
        <span className={styles.statLabel}>
          {translation("Stats.scheduled")}
        </span>
        <strong className={styles.statValue}>{stats.scheduled}</strong>
      </article>

      <article className={styles.statCard}>
        <span className={styles.statLabel}>{translation("Stats.sending")}</span>
        <strong className={styles.statValue}>{stats.sending}</strong>
      </article>

      <article className={styles.statCard}>
        <span className={styles.statLabel}>{translation("Stats.failed")}</span>
        <strong className={styles.statValue}>{stats.failed}</strong>
      </article>
    </div>
  );
}
