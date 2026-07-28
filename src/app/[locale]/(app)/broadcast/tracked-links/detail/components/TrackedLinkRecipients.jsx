import {
  formatTrackedLinkDate,
  getRecipientDisplayName,
} from "../../lib/tracked-links.helpers";
import styles from "../detail.module.css";

export default function TrackedLinkRecipients({ translation, recipients, clicked }) {
  const title = clicked ? translation("clicked") : translation("notClicked");
  const emptyText = clicked
    ? translation("noClickedUsers")
    : translation("allClickedUsers");

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {recipients.length === 0 ? (
        <div className={styles.emptyBox}>{emptyText}</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{translation("recipient")}</th>
                <th>{translation("email")}</th>
                <th>{translation("phone")}</th>
                {clicked ? <><th>{translation("clicks")}</th><th>{translation("firstClick")}</th><th>{translation("lastClick")}</th></> : <th>{translation("sentAt")}</th>}
              </tr>
            </thead>
            <tbody>
              {recipients.map((item) => (
                <tr key={item.trackedLinkId}>
                  <td className={styles.strongCell}>{getRecipientDisplayName(item)}</td>
                  <td>{item.email || "-"}</td>
                  <td>{item.phoneNumber || "-"}</td>
                  {clicked ? <><td>{item.clickCount}</td><td>{formatTrackedLinkDate(item.firstClickAt, { includeTime: true })}</td><td>{formatTrackedLinkDate(item.lastClickAt, { includeTime: true })}</td></> : <td>{formatTrackedLinkDate(item.createdAt, { includeTime: true })}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
