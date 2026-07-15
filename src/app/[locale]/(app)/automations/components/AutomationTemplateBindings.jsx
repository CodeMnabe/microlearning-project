"use client";

import { useTranslations } from "next-intl";

import PillSelect from "@/app/components/PillSelect/PillSelect";
import styles from "../automations.module.css";

const NAME_BINDING_KEYS = [
  "name",
  "nome",
  "user",
  "user_name",
];

const ORGANIZATION_BINDING_KEYS = [
  "empresa",
  "company",
  "organization",
  "organizacao",
  "organização",
  "organization_name",
];

/**
 * Campos utilizados para configurar os valores
 * associados às variáveis de um template WhatsApp.
 */
export default function AutomationTemplateBindings({
  templateOrder = [],
  bindings = {},
  onChange,
}) {
  const translation = useTranslations("Automations.modal");

  function updateBinding(key, nextBinding) {
    onChange({
      ...bindings,
      [key]: nextBinding,
    });
  }

  return (
    <div className={styles.templateBindingsGrid}>
      {templateOrder.map((key) => {
        const binding = bindings[key] || {
          type: "static",
          value: "",
        };

        const normalizedKey = String(key || "").toLowerCase();

        const isNameBinding =
          NAME_BINDING_KEYS.includes(normalizedKey);

        const isOrganizationBinding =
          ORGANIZATION_BINDING_KEYS.includes(normalizedKey);

        const isLocked =
          isNameBinding || isOrganizationBinding;

        return (
          <div
            key={key}
            className={styles.formGroup}
          >
            <label>{key}</label>

            {isLocked ? (
              <div className={styles.lockedField}>
                {isNameBinding
                  ? translation("systemUserName")
                  : translation("systemOrganizationName")}
              </div>
            ) : (
              <>
                <PillSelect
                  options={[
                    {
                      value: "static",
                      label: translation("staticText"),
                    },
                    {
                      value: "system:user.name",
                      label: translation("systemUserName"),
                    },
                    {
                      value: "system:organization.name",
                      label: translation(
                        "systemOrganizationName",
                      ),
                    },
                    {
                      value: "system:user.email",
                      label: translation("systemUserEmail"),
                    },
                    {
                      value: "system:user.phone",
                      label: translation("systemUserPhone"),
                    },
                  ]}
                  value={
                    binding.type === "system"
                      ? `system:${binding.path}`
                      : "static"
                  }
                  onChange={(value) => {
                    const normalizedValue = String(value);

                    if (
                      normalizedValue.startsWith("system:")
                    ) {
                      updateBinding(key, {
                        type: "system",
                        path: normalizedValue.slice(
                          "system:".length,
                        ),
                      });

                      return;
                    }

                    updateBinding(key, {
                      type: "static",
                      value: binding.value || "",
                    });
                  }}
                  fullWidth
                  portalToBody
                />

                {binding.type === "static" && (
                  <input
                    value={binding.value || ""}
                    onChange={(event) => {
                      updateBinding(key, {
                        type: "static",
                        value: event.target.value,
                      });
                    }}
                    placeholder={translation("valueFor", {
                      key,
                    })}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}