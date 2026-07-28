import Link from "next/link";
import {
  formatTrackedLinkDate,
  getTrackedLinkRateTone,
} from "../lib/tracked-links.helpers";
import styles from "../tracked-links.module.css";

function getRateClassName(rate) {
  const tone = getTrackedLinkRateTone(rate);
  if (tone === "good") return styles.rateGood;
  if (tone === "bad") return styles.rateBad;
  return styles.rateNeutral;
}

export default function TrackedLinksTable({ translation, items }) {
  return (
    <div className={styles.tableCard}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{translation("TrackedLinks.table.label")}</th>
              <th>{translation("TrackedLinks.table.key")}</th>
              <th>{translation("TrackedLinks.table.channel")}</th>
              <th>{translation("TrackedLinks.table.destination")}</th>
              <th>{translation("TrackedLinks.table.recipients")}</th>
              <th>{translation("TrackedLinks.table.clicked")}</th>
              <th>{translation("TrackedLinks.table.clickRate")}</th>
              <th>{translation("TrackedLinks.table.created")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const href = `/broadcast/tracked-links/detail?${new URLSearchParams({
                sendGroupId: item.sendGroupId || "",
              }).toString()}`;

              return (
                <tr key={item.sendGroupId || item.groupKey || `tracked-link-row-${index}`}>
                  <td><div className={styles.mainText}>{item.linkLabel || "-"}</div></td>
                  <td><span className={styles.code}>{item.linkKey || "-"}</span></td>
                  <td><span className={styles.channelBadge}>{item.channel || "-"}</span></td>
                  <td><div className={styles.urlCell} title={item.destinationUrl || "-"}>{item.destinationUrl || "-"}</div></td>
                  <td className={styles.numberCell}>{item.recipientCount}</td>
                  <td className={styles.numberCell}>{item.clickedCount}</td>
                  <td className={getRateClassName(item.clickRate)}>{item.clickRate}%</td>
                  <td>{formatTrackedLinkDate(item.createdAt)}</td>
                  <td><Link href={href} className={styles.viewBtn}>{translation("TrackedLinks.view")}</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
