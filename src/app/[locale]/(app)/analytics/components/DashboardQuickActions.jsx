"use client";

import { useTranslations } from "next-intl";

import styles from "../analytics.module.css";

/**
 * Ações rápidas da dashboard.
 *
 * Permite repor a vista predefinida e exportar o relatório em PDF.
 */
export default function DashboardQuickActions({
  onResetDashboard,
  onExportPdf,
  isExportingPdf,
  canExport,
}) {
  const translation = useTranslations("Analytics");

  return (
    <div className={styles.dashboardQuickActions}>
      <button
        type="button"
        className={styles.customizationResetButton}
        onClick={onResetDashboard}
      >
        {translation("customization.resetDashboard")}
      </button>

      <button
        type="button"
        className={`${styles.customizationResetButton} ${styles.exportButton}`}
        onClick={onExportPdf}
        disabled={isExportingPdf || !canExport}
      >
        {isExportingPdf
          ? "A exportar..."
          : translation("customization.exports")}
      </button>
    </div>
  );
}
