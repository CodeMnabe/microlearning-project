"use client";

import { useTranslations } from "next-intl";

import styles from "../analytics.module.css";

/**
 * Ações rápidas da dashboard.
 *
 * Permite repor a vista predefinida e exportar o relatório em PDF ou Excel.
 *
 * Enquanto uma exportação decorre, ambos os botões ficam desativados:
 * gerar os dois ficheiros ao mesmo tempo não traz nada e confunde.
 */
export default function DashboardQuickActions({
  onResetDashboard,
  onExportPdf,
  onExportExcel,
  isExportingPdf,
  isExportingExcel,
  canExport,
}) {
  const isExporting = isExportingPdf || isExportingExcel;
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
        disabled={isExporting || !canExport}
      >
        {isExportingPdf
          ? translation("customization.exporting")
          : translation("customization.exportPdf")}
      </button>

      <button
        type="button"
        className={`${styles.customizationResetButton} ${styles.exportButton}`}
        onClick={onExportExcel}
        disabled={isExporting || !canExport}
      >
        {isExportingExcel
          ? translation("customization.exporting")
          : translation("customization.exportExcel")}
      </button>
    </div>
  );
}
