"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";

import styles from "./analytics.module.css";

import { exportAnalyticsPdf } from "./lib/analytics.export";
import { exportAnalyticsExcel } from "./lib/analytics.excel";
import {
  buildExcelLabels,
  buildExcelFileName,
  getPeriodLabelKey,
} from "./lib/analytics.helpers";

import AnalyticsHeader from "./components/AnalyticsHeader";
import AnalyticsMetricGroups from "./components/AnalyticsMetricGroups";
import DistributionCharts from "./components/DistributionCharts";
import FullLinksModal from "./components/FullLinksModal";
import OperationalSummary from "./components/OperationalSummary";
import TopLinksRanking from "./components/TopLinksRanking";
import TrendCharts from "./components/TrendCharts";

import {
  useAnalyticsDerivedData,
  useAnalyticsFormatter,
  useAnalyticsMetrics,
  useDashboardVisibility,
} from "./hooks/analytics.hooks";

/**
 * Página principal da dashboard Analytics.
 *
 * Responsável apenas por:
 * - chamar os hooks da camada;
 * - compor a interface;
 * - passar dados e callbacks aos componentes;
 * - acionar a exportação do relatório.
 *
 * Não deve:
 * - fazer fetches;
 * - calcular métricas ou dados derivados;
 * - conter JSX detalhado dos cards, gráficos ou rankings.
 */
export default function AnalyticsPage() {
  const translation = useTranslations("Analytics");
  const locale = useLocale();
  const { format } = useAnalyticsFormatter(locale);

  const { user, loading: authLoading } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const { startLoading, stopLoading } = useGlobalLoader();

  const orgId = org?.id;

  const { metrics, error, period, setPeriod, isLoadingMetrics, loadMetrics } =
    useAnalyticsMetrics({
      authLoading,
      orgLoading,
      orgId,
      startLoading,
      stopLoading,
      translation,
    });

  const data = useAnalyticsDerivedData({ metrics, translation });

  const {
    visibleMetricGroups,
    visibleChartSections,
    toggleMetricGroup,
    toggleChartSection,
    resetDashboardView,
  } = useDashboardVisibility();

  const [isFullLinksListOpen, setIsFullLinksListOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const exportRef = useRef(null);

  /**
   * Exporta o relatório com base nos dados já carregados.
   *
   * A geração do PDF fica isolada em `lib/analytics.export`.
   */
  async function handleExportPdf() {
    if (!metrics || !exportRef.current || isExportingPdf) return;

    setIsExportingPdf(true);

    try {
      await exportAnalyticsPdf({
        exportElement: exportRef.current,
        period,
        exportClassName: styles.exportingPdf,
      });
    } catch (err) {
      console.error("[analytics] Failed to export PDF:", err);
    } finally {
      setIsExportingPdf(false);
    }
  }

  /**
   * Exporta os indicadores para Excel.
   *
   * Ao contrário do PDF, não captura o ecrã: usa os dados já em memória.
   * A construção do livro fica isolada em `lib/analytics.excel` e as
   * etiquetas são traduzidas aqui, para que essa camada não dependa
   * do next-intl.
   */
  async function handleExportExcel() {
    if (!metrics || isExportingExcel) return;

    setIsExportingExcel(true);

    try {
      const exportedAt = new Date();

      await exportAnalyticsExcel({
        data,
        meta: {
          organizationName: org?.name ?? "",
          periodLabel: translation(getPeriodLabelKey(period)),
          exportedAt,
          exportedAtLabel: new Intl.DateTimeFormat(locale, {
            dateStyle: "short",
            timeStyle: "short",
          }).format(exportedAt),
          fileName: buildExcelFileName(period, exportedAt),
          labels: buildExcelLabels(translation),
        },
      });
    } catch (err) {
      console.error("[analytics] Failed to export Excel:", err);
    } finally {
      setIsExportingExcel(false);
    }
  }

  return (
    <main
      ref={exportRef}
      data-analytics-pdf-root="true"
      className={styles.page}
    >
      <AnalyticsHeader
        translation={translation}
        orgId={orgId}
        period={period}
        onPeriodChange={setPeriod}
        isLoadingMetrics={isLoadingMetrics}
        onRefresh={loadMetrics}
      />

      {!orgId && !authLoading && !orgLoading && (
        <div className={styles.errorBox}>{translation("errors.noOrg")}</div>
      )}

      {error && <div className={styles.errorBox}>{error}</div>}

      {!metrics && !error ? (
        <div className={styles.empty}>{translation("loading")}</div>
      ) : null}

      {metrics && (
        <>
          <AnalyticsMetricGroups
            data={data}
            format={format}
            visibleMetricGroups={visibleMetricGroups}
            onToggleGroup={toggleMetricGroup}
            onResetDashboard={resetDashboardView}
            onExportPdf={handleExportPdf}
            onExportExcel={handleExportExcel}
            isExportingPdf={isExportingPdf}
            isExportingExcel={isExportingExcel}
            canExport={Boolean(metrics)}
          />

          <DistributionCharts
            messagesChartData={data.messagesChartData}
            templatesChartData={data.templatesChartData}
            isVisible={visibleChartSections.distribution}
            onToggle={() => toggleChartSection("distribution")}
          />

          <div data-pdf-section>
            <TopLinksRanking
              translation={translation}
              topTrackedLinks={data.topTrackedLinks}
              allTrackedLinks={data.allTrackedLinks}
              format={format}
              onViewAll={() => setIsFullLinksListOpen(true)}
            />
          </div>

          <FullLinksModal
            isOpen={isFullLinksListOpen}
            onClose={() => setIsFullLinksListOpen(false)}
            title={translation("rankings.columns.allLinksTitle")}
            description={translation("rankings.columns.allLinksDescription")}
            closeLabel={translation("rankings.columns.close")}
            linkLabel={translation("rankings.columns.link")}
            clicksLabel={translation("rankings.columns.clicks")}
            rows={data.allTrackedLinks}
            format={format}
          />

          <TrendCharts
            dailyMessagesData={data.dailyMessagesData}
            dailyClicksData={data.dailyClicksData}
            dailyAutomationRunsData={data.dailyAutomationRunsData}
            locale={locale}
            isVisible={visibleChartSections.trends}
            onToggle={() => toggleChartSection("trends")}
          />

          <div data-pdf-section>
            <OperationalSummary
              translation={translation}
              users={data.users}
              messages={data.messages}
              automations={data.automations}
              scheduledBroadcasts={data.scheduledBroadcasts}
              templates={data.templates}
              format={format}
              hasOperationalAttentionWarning={
                data.hasOperationalAttentionWarning
              }
              operationalAttentionTotal={data.operationalAttentionTotal}
            />
          </div>
        </>
      )}
    </main>
  );
}
