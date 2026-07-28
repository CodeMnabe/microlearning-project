import styles from "../../scheduled.module.css";

/**
 * Cartões de resumo no topo do modal de detalhe: canal, estado e
 * número de destinatários.
 */
export default function ScheduledViewSummaryCards({
  translation,
  item,
  recipientCount,
}) {
  return (
    <div className={styles.viewSummaryCards}>
      <div className={styles.viewSummaryCard}>
        <span>{translation("Table.channel")}</span>
        <strong>{translation(`Channels.${item.channel}`)}</strong>
      </div>

      <div className={styles.viewSummaryCard}>
        <span>{translation("Table.status")}</span>
        <strong>{translation(`Statuses.${item.status}`)}</strong>
      </div>

      <div className={styles.viewSummaryCard}>
        <span>{translation("Table.recipients")}</span>
        <strong>{recipientCount}</strong>
      </div>
    </div>
  );
}
