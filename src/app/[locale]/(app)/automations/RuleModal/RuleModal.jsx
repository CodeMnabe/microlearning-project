"use client";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import styles from "../automations.module.css";
import PillSelect from "@/app/components/PillSelect/PillSelect";
import { useAlert } from "@/app/components/Alert/AlertProvider";

const CHANNEL_OPTIONS = [
  {
    value: "whatsapp",
    label: "WhatsApp",
  },
  {
    value: "teams",
    label: "Teams",
  },
];

export function RuleModal({
  open,
  onClose,
  onSave,
  assistants,
  initialRule,
  saving,
  triggerOptions,
  safeJsonParse,
}) {
  const isEdit = Boolean(initialRule?.id);
  const translation = useTranslations("Automations.modal");
  const showAlert = useAlert();
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("user.created");
  const [channel, setChannel] = useState("whatsapp");
  const [assistantId, setAssistantId] = useState("");
  const [delayMinutes, setDelayMinutes] = useState("0");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;

    const payload = safeJsonParse(initialRule?.payload, {});

    setName(initialRule?.name || "");
    setTriggerType(initialRule?.trigger_type || "user.created");
    setChannel(initialRule?.channel || "whatsapp");
    setAssistantId(initialRule?.assistant_id ?? "");
    setDelayMinutes(String(initialRule?.delay_minutes ?? 0));
    setMessage(payload.message || "");
  }, [initialRule, open, safeJsonParse]);

  if (!open) return null;

  const assistantOptions = [
    {
      value: "",
      label:
        triggerType === "user.inactive"
          ? translation("anyAssistantFallback")
          : translation("anyAssistant"),
    },
    ...assistants.map((a) => ({ value: a.id, label: a.name })),
  ];

  const disabledTrigger = triggerOptions.find(
    (t) => t.value === triggerType,
  )?.disabled;

  async function handleSubmit(e) {
    e.preventDefault();

    if (disabledTrigger) {
      await showAlert({
        title: translation("alerts.disabledTrigger.title"),
        message: translation("alerts.disabledTrigger.message"),
        tone: "warning",
      });

      return;
    }

    if (!name.trim()) {
      await showAlert({
        title: translation("alerts.nameRequired.title"),
        message: translation("alerts.nameRequired.message"),
        tone: "warning",
      });

      return;
    }

    const parsedDelay = Number(delayMinutes);

    if (!Number.isFinite(parsedDelay) || parsedDelay < 0) {
      await showAlert({
        title: translation("alerts.invalidDelay.title"),
        message: translation("alerts.invalidDelay.message"),
        tone: "warning",
      });

      return;
    }

    if (message.trim().length === 0) {
      await showAlert({
        title: translation("alerts.contentRequired.title"),
        message: translation("alerts.contentRequired.message"),
        tone: "warning",
      });

      return;
    }

    await onSave({
      id: initialRule?.id,
      name: name.trim(),
      trigger_type: triggerType,
      channel,
      assistant_id: assistantId === "" ? null : Number(assistantId),
      delay_minutes: parsedDelay,
      payload: { message },
    });
  }

  return (
    <div
      className={styles.modalOverlay}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modalContent} role="dialog" aria-modal="true">
        <h3 className={styles.modalTitle}>
          {isEdit ? translation("editTitle") : translation("newTitle")}
        </h3>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.formGroup}>
            <label>{translation("name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className={styles.formGroup}>
            <label>{translation("trigger")}</label>
            <PillSelect
              options={triggerOptions.map((t) => ({
                value: t.value,
                label: t.disabled ? `${t.label} (coming soon)` : t.label,
              }))}
              value={triggerType}
              onChange={(val) => setTriggerType(val)}
              fullWidth
              portalToBody
            />
          </div>

          <div className={styles.formGroup}>
            <label>{translation("channel")}</label>
            <PillSelect
              options={CHANNEL_OPTIONS}
              value={channel}
              onChange={(val) => setChannel(val)}
              fullWidth
              portalToBody
            />
          </div>

          <div className={styles.formGroup}>
            <label>{translation("assistantScope")}</label>
            <PillSelect
              options={assistantOptions}
              value={assistantId}
              onChange={(val) => setAssistantId(val)}
              fullWidth
              portalToBody
            />
            {triggerType === "user.inactive" && (
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                Assistant-specific inactivity rules win. “Any assistant
                (fallback)” only applies when the user’s current assistant does
                not already have a specific inactivity rule on this channel.
              </div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label>{translation("delay")}</label>
            <input
              type="number"
              min="0"
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>{translation("message")}</label>
            <textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={translation("messagePlaceholder", {
                userName: "{userName}",
                organizationName: "{organizationName}",
              })}
            />
            {channel === "whatsapp" && (
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                {translation("openingHint")}
              </div>
            )}
          </div>

          <div className={styles.buttonGroup}>
            <button type="submit" disabled={saving || disabledTrigger}>
              {saving
                ? translation("saving")
                : isEdit
                  ? translation("save")
                  : translation("createAutomation")}
            </button>
            <button type="button" onClick={onClose} disabled={saving}>
              {translation("cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
