"use client";

import { useTranslations } from "next-intl";

import PillSelect from "@/app/components/PillSelect/PillSelect";

import { CHANNEL_OPTIONS } from "../lib/automations.constants";

import styles from "../automations.module.css";

import AutomationTemplateBindings from "./AutomationTemplateBindings";

/**
 * Modal visual para criar ou editar uma regra.
 *
 * Toda a lógica e estado do formulário são recebidos
 * através de props e geridos pelo hook useAutomations.
 */
export default function AutomationRuleModal({
  open,
  onClose,
  onSubmit,

  form,
  onFieldChange,

  saving,
  isEdit,
  disabledTrigger,

  triggerOptions = [],
  assistantOptions = [],
  templateOptions = [],
  templateOrder = [],

  onTemplateBindingsChange,
}) {
  const translation = useTranslations(
    "Automations.modal",
  );

  if (!open) return null;

  return (
    <div
      className={styles.modalOverlay}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={styles.modalContent}
        role="dialog"
        aria-modal="true"
        aria-labelledby="automation-rule-modal-title"
      >
        <h3
          id="automation-rule-modal-title"
          className={styles.modalTitle}
        >
          {isEdit
            ? translation("editTitle")
            : translation("newTitle")}
        </h3>

        <form
          onSubmit={onSubmit}
          className={styles.form}
          noValidate
        >
          <div className={styles.formGroup}>
            <label htmlFor="automation-rule-name">
              {translation("name")}
            </label>

            <input
              id="automation-rule-name"
              value={form.name}
              onChange={(event) => {
                onFieldChange(
                  "name",
                  event.target.value,
                );
              }}
            />
          </div>

          <div className={styles.formGroup}>
            <label>
              {translation("trigger")}
            </label>

            <PillSelect
              options={triggerOptions.map(
                (trigger) => ({
                  value: trigger.value,

                  label: trigger.disabled
                    ? `${trigger.label} (${translation("comingSoon")})`
                    : trigger.label,
                }),
              )}
              value={form.triggerType}
              onChange={(value) => {
                onFieldChange(
                  "triggerType",
                  value,
                );
              }}
              fullWidth
              portalToBody
            />
          </div>

          <div className={styles.formGroup}>
            <label>
              {translation("channel")}
            </label>

            <PillSelect
              options={CHANNEL_OPTIONS}
              value={form.channel}
              onChange={(value) => {
                onFieldChange(
                  "channel",
                  value,
                );
              }}
              fullWidth
              portalToBody
            />
          </div>

          <div className={styles.formGroup}>
            <label>
              {translation("assistantScope")}
            </label>

            <PillSelect
              options={assistantOptions}
              value={form.assistantId}
              onChange={(value) => {
                onFieldChange(
                  "assistantId",
                  value,
                );
              }}
              fullWidth
              portalToBody
            />

           {form.triggerType === "user.inactive" && (
            <div className={styles.formHint}>
                {translation("assistantFallbackHelp")}
            </div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="automation-rule-delay">
              {translation("delay")}
            </label>

            <input
              id="automation-rule-delay"
              type="number"
              min="0"
              value={form.delayMinutes}
              onChange={(event) => {
                onFieldChange(
                  "delayMinutes",
                  event.target.value,
                );
              }}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="automation-rule-message">
              {translation("message")}
            </label>

            <textarea
              id="automation-rule-message"
              rows={6}
              value={form.message}
              onChange={(event) => {
                onFieldChange(
                  "message",
                  event.target.value,
                );
              }}
              placeholder={translation(
                "messagePlaceholder",
                {
                  userName: "{userName}",
                  organizationName:
                    "{organizationName}",
                },
              )}
            />
          </div>

          {form.channel === "whatsapp" && (
            <>
              <div className={styles.formGroup}>
                <label>
                  {translation(
                    "whatsappTemplate",
                  )}
                </label>

                <PillSelect
                  options={[
                    {
                      value: "",
                      label:
                        translation(
                          "noTemplate",
                        ),
                    },
                    ...templateOptions,
                  ]}
                  value={
                    form.whatsappTemplateId
                  }
                  onChange={(value) => {
                    onFieldChange(
                      "whatsappTemplateId",
                      value,
                    );
                  }}
                  fullWidth
                  portalToBody
                />
              </div>

              {templateOrder.length > 0 && (
                <div
                  className={styles.formGroup}
                >
                  <label>
                    {translation(
                      "templateBindings",
                    )}
                  </label>

                  <AutomationTemplateBindings
                    templateOrder={
                      templateOrder
                    }
                    bindings={
                      form.templateBindings
                    }
                    onChange={
                      onTemplateBindingsChange
                    }
                  />
                </div>
              )}
            </>
          )}

          <div className={styles.buttonGroup}>
            <button
              type="submit"
              disabled={
                saving || disabledTrigger
              }
            >
              {saving
                ? translation("saving")
                : isEdit
                  ? translation("save")
                  : translation(
                      "createAutomation",
                    )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              {translation("cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}