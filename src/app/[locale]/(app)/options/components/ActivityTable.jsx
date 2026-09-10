import { History } from "lucide-react";
import styles from "../options.module.css";
import {
  actionLabelKey,
  actorLabel,
  areaOfAction,
  describeDetails,
  entityLabel,
  formatDateTime,
} from "../helpers/activity.helpers";

export default function ActivityTable({
  translation,
  locale,
  items,
  loading,
  hasFilters,
}) {
  if (loading) {
    return (
      <div className={styles.stateBox} role="status">
        {translation("Loading")}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className={styles.stateBox}>
        <History aria-hidden className={styles.emptyIcon} />
        <h3 className={styles.emptyTitle}>
          {translation(hasFilters ? "Empty.filteredTitle" : "Empty.title")}
        </h3>
        <p className={styles.emptyText}>
          {translation(hasFilters ? "Empty.filteredText" : "Empty.text")}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{translation("Table.when")}</th>
            <th>{translation("Table.action")}</th>
            <th>{translation("Table.entity")}</th>
            <th>{translation("Table.details")}</th>
            <th>{translation("Table.actor")}</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => {
            const area = areaOfAction(item.action);
            const details = describeDetails(item, translation, locale);

            return (
              <tr key={item.id}>
                <td className={styles.whenCell}>
                  {formatDateTime(item.created_at, locale)}
                </td>

                <td>
                  <div className={styles.actionCell}>
                    <span className={styles.actionLabel}>
                      {translation(actionLabelKey(item.action))}
                    </span>
                    {area ? (
                      <span className={styles.areaTag}>
                        {translation(`Areas.${area}`)}
                      </span>
                    ) : null}
                  </div>
                </td>

                <td className={styles.entityCell}>{entityLabel(item)}</td>

                <td className={styles.detailsCell}>
                  {details.length ? details.join(" · ") : "-"}
                </td>

                <td className={styles.actorCell}>
                  {actorLabel(item, translation)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
