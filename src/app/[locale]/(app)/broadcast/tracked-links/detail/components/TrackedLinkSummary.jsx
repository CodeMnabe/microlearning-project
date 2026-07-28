import { formatTrackedLinkDate } from "../../lib/tracked-links.helpers";
import styles from "../detail.module.css";

export default function TrackedLinkSummary({ translation, summary }) {
  const metrics = [
    ["recipient", summary.totalRecipients],
    ["clicked", summary.clickedCount],
    ["notClicked", summary.notClickedCount],
    ["totalClicks", summary.totalClicks],
    ["clickRate", `${summary.clickRate}%`],
    ["created", formatTrackedLinkDate(summary.createdAt, { includeTime: true })],
  ];

  return (
    <div className={styles.headerCard}>
      <div className={styles.headerInfo}>
        <h1 className={styles.title}>{summary.linkLabel || translation("trackedLink")}</h1>
        <div className={styles.metaRow}>
          <span className={styles.metaPill}>{summary.channel || "-"}</span>
          <span className={styles.metaPill}>{translation("key")}: <code>{summary.linkKey || "-"}</code></span>
        </div>
        <div className={styles.destinationBox}>
          <div className={styles.destinationLabel}>{translation("destinationUrl")}</div>
          <div className={styles.destinationValue}>{summary.destinationUrl || "-"}</div>
        </div>
      </div>
      <div className={styles.cardsGrid}>
        {metrics.map(([label, value]) => (
          <div className={styles.kpiCard} key={label}>
            <div className={styles.kpiLabel}>{translation(label)}</div>
            <div className={styles.kpiValue}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
