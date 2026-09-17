"use client";
import styles from "./users.module.css";
import PillSelect from "@/app/components/PillSelect/PillSelect";
import { useTranslations } from "next-intl";

// Assistentes atribuídos a um utilizador e, havendo mais de um, qual está ativo.
export default function AssistantsField({
  assistants = [],
  assistantIds = [],
  activeAssistantId = null,
  onChange,
}) {
  const translation = useTranslations("UserAssistants");

  function toggle(id) {
    const nextIds = assistantIds.includes(id)
      ? assistantIds.filter((x) => x !== id)
      : [...assistantIds, id];

    const nextActive = nextIds.includes(activeAssistantId)
      ? activeAssistantId
      : (nextIds[0] ?? null);

    onChange({ assistantIds: nextIds, activeAssistantId: nextActive });
  }

  const assigned = assistants.filter((a) => assistantIds.includes(a.id));

  return (
    <>
      <div className={styles.formGroup}>
        <label>{translation("assigned")}</label>
        <div className={styles.tagsWrap}>
          {assistants.map((a) => {
            const checked = assistantIds.includes(a.id);
            return (
              <label
                key={a.id}
                className={`${styles.chip} ${styles.chipCheck} ${
                  checked ? styles.chipChecked : ""
                }`}
              >
                <input
                  type="checkbox"
                  className={styles.visuallyHidden}
                  checked={checked}
                  onChange={() => toggle(a.id)}
                />
                <span className={styles.checkboxSquare} aria-hidden="true">
                  <svg viewBox="0 0 24 24" className={styles.checkIcon}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
                <span className={styles.chipText}>{a.name}</span>
              </label>
            );
          })}
          {!assistants.length && (
            <div style={{ color: "var(--ui-muted)" }}>
              {translation("none")}
            </div>
          )}
        </div>
      </div>

      {assigned.length > 1 && (
        <div className={styles.formGroup}>
          <label>{translation("active")}</label>
          <PillSelect
            options={assigned.map((a) => ({ value: a.id, label: a.name }))}
            value={activeAssistantId ?? ""}
            onChange={(val) =>
              onChange({ assistantIds, activeAssistantId: val })
            }
            fullWidth
            portalToBody
          />
          <small style={{ color: "var(--ui-muted)" }}>
            {translation("activeHint")}
          </small>
        </div>
      )}
    </>
  );
}
