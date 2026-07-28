import { normalizeTemplateStatusKey } from "../lib/templates.helpers";
import { TRANSLATED_TEMPLATE_STATUS_KEYS } from "../lib/templates.constants";
import styles from "../templates.module.css";

export default function TemplateStatusPill({ status, translation }) {
  const rawStatus = status || "NEW";
  const statusKey = normalizeTemplateStatusKey(rawStatus);
  const label = TRANSLATED_TEMPLATE_STATUS_KEYS.has(statusKey)
    ? translation(`statuses.${statusKey}`)
    : rawStatus;

  return (
    <span
      className={`${styles.statusPill} ${
        styles[`status_${statusKey}`] || ""
      }`}
    >
      {label}
    </span>
  );
}
