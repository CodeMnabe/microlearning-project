"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../automations.module.css";
import PillSelect from "@/app/components/PillSelect/PillSelect";

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

function getTemplateOptionValue(template) {
  return template?.whatsappTemplateId || template?.id || "";
}

export function RuleModal({
  open,
  onClose,
  onSave,
  assistants,
  whatsappTemplates,
  initialRule,
  saving,
  triggerOptions,
  safeJsonParse,
}) {
  const isEdit = Boolean(initialRule?.id);

  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("user.created");
  const [channel, setChannel] = useState("whatsapp");
  const [assistantId, setAssistantId] = useState("");
  const [delayMinutes, setDelayMinutes] = useState("0");
  const [message, setMessage] = useState("");
  const [whatsappTemplateId, setWhatsappTemplateId] = useState("");
  const [templateBindings, setTemplateBindings] = useState({});

  useEffect(() => {
    if (!open) return;

    const payload = safeJsonParse(initialRule?.payload, {});

    setName(initialRule?.name || "");
    setTriggerType(initialRule?.trigger_type || "user.created");
    setChannel(initialRule?.channel || "whatsapp");
    setAssistantId(initialRule?.assistant_id ?? "");
    setDelayMinutes(String(initialRule?.delay_minutes ?? 0));
    setMessage(payload.message || "");
    setWhatsappTemplateId(initialRule?.whatsapp_template_id || "");
    setTemplateBindings(payload.templateBindings || {});
  }, [initialRule, open, safeJsonParse]);

  const selectedTemplate = useMemo(
    () =>
      whatsappTemplates.find(
        (t) => getTemplateOptionValue(t) === whatsappTemplateId,
      ) || null,
    [whatsappTemplates, whatsappTemplateId],
  );

  const templateOrder = useMemo(() => {
    const components = safeJsonParse(selectedTemplate?.components, {});
    return Array.isArray(components?.order) ? components.order : [];
  }, [selectedTemplate, safeJsonParse]);

  useEffect(() => {
    if (!templateOrder.length) return;

    setTemplateBindings((prev) => {
      const next = { ...prev };

      for (const key of templateOrder) {
        const normalized = String(key || "").toLowerCase();

        if (!next[key]) {
          if (["name", "nome", "user", "user_name"].includes(normalized)) {
            next[key] = { type: "system", path: "user.name" };
          } else if (
            [
              "empresa",
              "company",
              "organization",
              "organização",
              "organizacao",
              "organization_name",
            ].includes(normalized)
          ) {
            next[key] = { type: "system", path: "organization.name" };
          } else {
            next[key] = { type: "static", value: "" };
          }
        }
      }

      return next;
    });
  }, [templateOrder]);

  if (!open) return null;

  const templateOptions = whatsappTemplates
    .filter((t) => getTemplateOptionValue(t))
    .map((t) => ({
      value: getTemplateOptionValue(t),
      label: `${t.name} (${t.language || "pt-PT"})`,
    }));

  const assistantOptions = [
    {
      value: "",
      label:
        triggerType === "user.inactive"
          ? "Any assistant (fallback)"
          : "Any assistant",
    },
    ...assistants.map((a) => ({ value: a.id, label: a.name })),
  ];

  const disabledTrigger = triggerOptions.find(
    (t) => t.value === triggerType,
  )?.disabled;

  async function handleSubmit(e) {
    e.preventDefault();
    if (disabledTrigger) return;

    const payload = {
      message,
      templateBindings,
    };

    await onSave({
      id: initialRule?.id,
      name: name.trim(),
      trigger_type: triggerType,
      channel,
      assistant_id: assistantId === "" ? null : Number(assistantId),
      delay_minutes: Math.max(0, Number(delayMinutes || 0)),
      payload,
      whatsapp_template_id:
        channel === "whatsapp" && whatsappTemplateId
          ? whatsappTemplateId
          : null,
    });
  }
  return (
    <div
      className={styles.modalOverlay}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modalContent} role="dialog" aria-modal="true">
        <h3 className={styles.modalTitle}>
          {isEdit ? "Edit automation" : "New automation"}
        </h3>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Trigger</label>
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
            <label>Channel</label>
            <PillSelect
              options={CHANNEL_OPTIONS}
              value={channel}
              onChange={(val) => setChannel(val)}
              fullWidth
              portalToBody
            />
          </div>

          <div className={styles.formGroup}>
            <label>Assistant scope</label>
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
            <label>Delay (minutes)</label>
            <input
              type="number"
              min="0"
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Message</label>
            <textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Bem-vindo {{user_name}} à {{organization_name}}!"
            />
          </div>

          {channel === "whatsapp" && (
            <>
              <div className={styles.formGroup}>
                <label>WhatsApp template</label>
                <PillSelect
                  options={[
                    { value: "", label: "No template" },
                    ...templateOptions,
                  ]}
                  value={whatsappTemplateId}
                  onChange={(val) => setWhatsappTemplateId(val)}
                  fullWidth
                  portalToBody
                />
              </div>

              {templateOrder.length > 0 && (
                <div className={styles.formGroup}>
                  <label>Template bindings</label>
                  <div style={{ display: "grid", gap: 10 }}>
                    {templateOrder.map((key) => {
                      const binding = templateBindings[key] || {
                        type: "static",
                        value: "",
                      };
                      const normalized = String(key || "").toLowerCase();
                      const lockedName = [
                        "name",
                        "nome",
                        "user",
                        "user_name",
                      ].includes(normalized);
                      const lockedOrg = [
                        "empresa",
                        "company",
                        "organization",
                        "organizacao",
                        "organização",
                        "organization_name",
                      ].includes(normalized);
                      const locked = lockedName || lockedOrg;

                      return (
                        <div key={key} className={styles.formGroup}>
                          <label>{key}</label>

                          {locked ? (
                            <div className={styles.lockedField}>
                              {lockedName
                                ? "System: user.name"
                                : "System: organization.name"}
                            </div>
                          ) : (
                            <>
                              <PillSelect
                                options={[
                                  { value: "static", label: "Static text" },
                                  {
                                    value: "system:user.name",
                                    label: "System: user.name",
                                  },
                                  {
                                    value: "system:organization.name",
                                    label: "System: organization.name",
                                  },
                                  {
                                    value: "system:user.email",
                                    label: "System: user.email",
                                  },
                                  {
                                    value: "system:user.phone",
                                    label: "System: user.phone",
                                  },
                                ]}
                                value={
                                  binding.type === "system"
                                    ? `system:${binding.path}`
                                    : "static"
                                }
                                onChange={(val) => {
                                  setTemplateBindings((prev) => {
                                    const next = { ...prev };

                                    if (String(val).startsWith("system:")) {
                                      next[key] = {
                                        type: "system",
                                        path: String(val).slice(
                                          "system:".length,
                                        ),
                                      };
                                    } else {
                                      next[key] = {
                                        type: "static",
                                        value: next[key]?.value || "",
                                      };
                                    }

                                    return next;
                                  });
                                }}
                                fullWidth
                                portalToBody
                              />

                              {binding.type === "static" && (
                                <input
                                  value={binding.value || ""}
                                  onChange={(e) =>
                                    setTemplateBindings((prev) => ({
                                      ...prev,
                                      [key]: {
                                        type: "static",
                                        value: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder={`Value for ${key}`}
                                />
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div className={styles.buttonGroup}>
            <button type="submit" disabled={saving || disabledTrigger}>
              {saving ? "Saving..." : isEdit ? "Save" : "Create automation"}
            </button>
            <button type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
