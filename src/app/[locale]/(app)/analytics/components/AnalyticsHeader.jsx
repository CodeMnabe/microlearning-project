import { RefreshCw } from "lucide-react";

import styles from "../analytics.module.css";
import { PERIOD_OPTIONS } from "../lib/analytics.constants";


/* Cabeçalho da página com título, nota, filtros e botão de refresh */
export default function AnalyticsHeader({
  translation,
  orgId,
  period,
  onPeriodChange,
  isLoadingMetrics,
  onRefresh,
}) {
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.title}>{translation("title")}</h1>
      </div>

      <div className={styles.headerActions}>
        <div
          className={styles.periodTabs}
          aria-label={translation("periods.label")}
        >
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.periodButton} ${
                period === option.value ? styles.periodButtonActive : ""
              }`}
              onClick={() => onPeriodChange(option.value)}
              disabled={!orgId || isLoadingMetrics}
            >
              {translation(option.labelKey)}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={styles.refreshButton}
          onClick={onRefresh}
          disabled={!orgId || isLoadingMetrics}
        >
          <RefreshCw
            size={16}
            className={isLoadingMetrics ? styles.spinIcon : ""}
          />

          {isLoadingMetrics ? translation("loading") : translation("refresh")}
        </button>
      </div>
    </header>
  );
}
     
     
     
     
