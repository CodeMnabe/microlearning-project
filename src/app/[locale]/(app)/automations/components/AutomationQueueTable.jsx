"use client";

import { CalendarClock } from "lucide-react";
import { useTranslations } from "next-intl";

import styles from "../automations.module.css";
import AutomationStatusChip from "./AutomationStatusChip";

import {
  formatDateTime,
  summarizeQueueDetails,
} from "../lib/automations.helpers";

/**
 * Apresenta os runs que ainda estão em fila,
 * materialização ou processamento.
 */
export default function AutomationQueueTable({
  runs = [],
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
            {translation("rulesTable.trigger")}
          </div>

          <div className={styles.cellHead}>
            {translation("rulesTable.channel")}
          </div>

          <div className={styles.cellHead}>
            {translation("rulesTable.dueAt")}
          </div>

          <div className={styles.cellHead}>
            {translation("rulesTable.runStatus")}
          </div>

          <div className={styles.cellHead}>
            {translation("rulesTable.queueDetails")}
          </div>
        </div>

        {runs.map((run, index) => {
          const rule = ruleMap?.get(run.rule_id);
          const details = summarizeQueueDetails(run);

          return (
            <div
              key={run.id}
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
                    {item.user_row?.name ||
                      translation("userFallback", {
                        id: item.user_id,
                      })}
                  </div>

                  <div className={styles.subline}>
                    {run.user_row?.name ||
                      translation("userFallback", {
                        id: run.user_id,
                      })}
                  </div>
                </div>
              </div>

              <div className={styles.cellPhone}>
                {getTriggerLabel(run.trigger_type)}
              </div>

              <div className={styles.cellPhone}>{run.channel}</div>

              <div className={styles.cellPhone}>
                {formatDateTime(run.scheduled_for)}
              </div>

              <div className={styles.cellPhone}>
                <AutomationStatusChip status={run.status} />
              </div>

              <div className={styles.cellTags}>
                <div
                  className={styles.messagePreview}
                  title={details}
                >
                  {details}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}