"use client";

import {
  Eye,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

import { useTranslations } from "next-intl";

import styles from "../automations.module.css";

export default function ReadChainsFeatureCard({
  enabled,
  saving,
  onToggle,
}) {
  const translation = useTranslations(
    "Automations.readChains",
  );

  return (
    <div className={styles.readChainFloatingCard}>
      <div className={styles.readChainFloatingIcon}>
        <Eye size={18} />
      </div>

      <div className={styles.readChainFloatingMain}>
        <div className={styles.readChainFloatingTitle}>
          {translation("title")}
        </div>

        <div className={styles.readChainFloatingText}>
          {translation("description")}
        </div>

        <div className={styles.readChainFloatingMeta}>
          {enabled
            ? translation("enabled")
            : translation("disabled")}
        </div>
      </div>

      <button
        type="button"
        className={`${styles.readChainFloatingToggle} ${
          enabled
            ? styles.readChainFloatingToggleOn
            : ""
        }`}
        onClick={onToggle}
        disabled={saving}
        title={
          enabled
            ? translation("disable")
            : translation("enable")
        }
      >
        {enabled ? (
          <ToggleRight size={20} />
        ) : (
          <ToggleLeft size={20} />
        )}

        <span>
          {saving
            ? translation("saving")
            : enabled
              ? translation("on")
              : translation("off")}
        </span>
      </button>
    </div>
  );
}