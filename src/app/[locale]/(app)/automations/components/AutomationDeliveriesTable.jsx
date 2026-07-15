"use client";

import { CalendarClock } from "lucide-react";
import { useTranslations } from "next-intl";

import styles from "../automations.module.css";
import AutomationStatusChip from "./AutomationStatusChip";

import {
  formatDateTime,
  summarizeMaterializedMessage,
} from "../lib/automations.helpers";

/**
 * Apresenta os runs que já foram convertidos
 * em scheduled broadcasts.
 */
export default function AutomationDeliveriesTable({
  deliveries = [],
  ruleMap,
  triggerOptions = [],
}) {
  const translation = useTranslations("Automations");

  function getTriggerLabel(triggerType) {
    const triggerOption = triggerOptions.find(
      (option) => option.value === triggerType,
    );

    return triggerOption?.label || translation("unknown");
  }

  return (
    <div className={styles.tableCard}>
      <div className={styles.table}>
        <div className={`${styles.row} ${styles.header}`}>
          <div className={styles.cellHead}>
            {translation("rulesTable.rule")}
          </div>

          <div className={styles.cellHead}>
            {translation("rulesTable.user")}
          </div>

          <div className={styles.cellHead}>
            {translation("rulesTable.channel")}
          </div>

          <div className={styles.cellHead}>
            {translation("rulesTable.scheduledFor")}
          </div>

          <div className={styles.cellHead}>
            {translation("rulesTable.broadcastStatus")}
          </div>

          <div className={styles.cellHead}>
            {translation("rulesTable.message")}
          </div>
        </div>

        {deliveries.map((item, index) => {
          const rule = ruleMap?.get(item.rule_id);

          const broadcastStatus =
            item.scheduled_broadcast?.status || item.status;

          const message = summarizeMaterializedMessage(item);

          return (
            <div
              key={item.id}
              className={`${styles.row} ${
                index % 2 ? styles.rowAlt : ""
              }`}
            >
              <div className={styles.cellName}>
                <div className={styles.avatar}>
                  <CalendarClock size={16} />
                </div>

                <div className={styles.nameBlock}>
                  <div className={styles.name}>
                    {rule?.name || "Deleted rule"}
                  </div>

                  <div className={styles.subline}>
                    {getTriggerLabel(item.trigger_type)}
                  </div>
                </div>
              </div>

              <div className={styles.cellPhone}>
                {item.user_row?.name || `User #${item.user_id}`}
              </div>

              <div className={styles.cellPhone}>
                {item.scheduled_broadcast?.channel || item.channel}
              </div>

              <div className={styles.cellPhone}>
                {formatDateTime(
                  item.scheduled_broadcast?.scheduled_for ||
                    item.scheduled_for,
                )}
              </div>

              <div className={styles.cellPhone}>
                <AutomationStatusChip status={broadcastStatus} />
              </div>

              <div className={styles.cellTags}>
                <div
                  className={styles.messagePreview}
                  title={message}
                >
                  {message}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}