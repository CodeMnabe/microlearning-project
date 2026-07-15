"use client";

import {
  Bot,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";

import styles from "../automations.module.css";
import { safeJsonParse } from "../lib/automations.helpers";

/**
 * Tabela responsável pela apresentação das regras de automação.
 *
 * Não realiza fetches nem altera dados diretamente.
 * Comunica as ações à página através de callbacks.
 */
export default function AutomationRulesTable({
  rules = [],
  assistantsById,
  triggerOptions = [],
  onToggle,
  onEdit,
  onDelete,
}) {
  const translation = useTranslations("Automations");

  return (
    <div className={styles.tableCard}>
      <div className={styles.table}>
        <div className={`${styles.row} ${styles.header}`}>
          <div className={styles.cellHead}>
            {translation("rulesTable.name")}
          </div>

          <div className={styles.cellHead}>
            {translation("rulesTable.trigger")}
          </div>

          <div className={styles.cellHead}>
            {translation("rulesTable.channel")}
          </div>

          <div className={styles.cellHead}>
            {translation("rulesTable.delay")}
          </div>

          <div className={styles.cellHead}>
            {translation("rulesTable.assistant")}
          </div>

          <div className={styles.cellHead}>
            {translation("rulesTable.message")}
          </div>

          <div className={styles.cellHeadRight} />
        </div>

        {rules.map((rule, index) => {
          const assistant = rule.assistant_id
            ? assistantsById?.get(Number(rule.assistant_id))
            : null;

          const payload = safeJsonParse(rule.payload, {});

          const triggerOption = triggerOptions.find(
            (option) => option.value === rule.trigger_type,
          );

          const TriggerIcon = triggerOption?.icon || Bot;

          return (
            <div
              key={rule.id}
              className={`${styles.row} ${
                index % 2 ? styles.rowAlt : ""
              }`}
            >
              <div className={styles.cellName}>
                <div className={styles.avatar}>
                  <TriggerIcon size={16} />
                </div>

                <div className={styles.nameBlock}>
                  <div className={styles.name}>{rule.name}</div>

                  <div className={styles.subline}>
                    {rule.is_active
                      ? translation("rulesTable.active")
                      : translation("rulesTable.paused")}
                  </div>
                </div>
              </div>

              <div className={styles.cellPhone}>
                {triggerOption?.label || translation("unknown")}
              </div>

              <div className={styles.cellPhone}>{rule.channel}</div>

              <div className={styles.cellPhone}>
                {rule.delay_minutes} min
              </div>

              <div className={styles.cellPhone}>
                {assistant?.name || translation("rulesTable.any")}
              </div>

              <div className={styles.cellTags}>
                <div
                  className={styles.messagePreview}
                  title={payload.message || "-"}
                >
                  {payload.message || "-"}
                </div>
              </div>

              <div className={styles.cellKebab}>
                <button
                  type="button"
                  className={styles.rowActBtn}
                  onClick={() => onToggle(rule)}
                  title={
                    rule.is_active
                      ? translation("rulesTable.pause")
                      : translation("rulesTable.activate")
                  }
                >
                  {rule.is_active ? (
                    <ToggleRight size={16} />
                  ) : (
                    <ToggleLeft size={16} />
                  )}
                </button>

                <button
                  type="button"
                  className={styles.rowActBtn}
                  onClick={() => onEdit(rule)}
                  title={translation("rulesTable.edit")}
                >
                  <Pencil size={16} />
                </button>

                <button
                  type="button"
                  className={`${styles.rowActBtn} ${styles.rowActBtnDanger}`}
                  onClick={() => onDelete(rule)}
                  title={translation("rulesTable.delete")}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}