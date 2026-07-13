
"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CheckCircle2,
  FileText,
  MessageSquare,
  MousePointerClick,
  Send,
  Users,
  Zap,
  } from "lucide-react";


import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import styles from "./analytics.module.css";


import { exportAnalyticsPdf } from "./lib/analytics.export";

import DescriptionInfo from "./components/DescriptionInfo";
import MetricCard from "./components/MetricCard";
import MetricGroup from "./components/MetricGroup";
import ChartCard from "./components/ChartCard";
import TrendChartCard from "./components/TrendChartCard";
import FullLinksModal from "./components/FullLinksModal";
import AnalyticsHeader from "./components/AnalyticsHeader";
import TopLinksRanking from "./components/TopLinksRanking";
import OperationalSummary from "./components/OperationalSummary";

import {
  useDashboardVisibility,
  useAnalyticsMetrics,
  useAnalyticsDerivedData,
  useAnalyticsFormatter,

} from "./hooks/analytics.hooks";



/**
 * Página principal da dashboard Analytics.
 *
 * Responsabilidades:
 * - obter o utilizador e a organização atual;
 * - carregar métricas através da API de Analytics;
 * - preparar dados derivados através dos hooks locais;
 * - renderizar cards, gráficos, rankings e resumo operacional;
 * - acionar a exportação do relatório.
 *
 * A page deve manter-se focada na composição da interface.
 * Lógica reutilizável deve ficar em hooks, lib ou componentes locais.
 */




export default function AnalyticsPage() {
 
  const translation = useTranslations("Analytics");
  const locale = useLocale();
  const { format } = useAnalyticsFormatter(locale);

  
  const { user, loading: authLoading } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const { startLoading, stopLoading } = useGlobalLoader();

 
  const orgId = org?.id;

  const {
  metrics,
  error,
  period,
  setPeriod,
  isLoadingMetrics,
  loadMetrics,
} = useAnalyticsMetrics({
  authLoading,
  orgLoading,
  orgId,
  startLoading,
  stopLoading,
  translation,
});
const {
  users,
  assistants,
  templates,
  messages,
  automations,
  scheduledBroadcasts,
  trackedLinks,
  pendingOutreach,

  topTrackedLinks,
  allTrackedLinks,

  dailyMessagesData,
  dailyClicksData,
  dailyAutomationRunsData,

  assistantCoverageRate,
  readRate,
  failedMessageRate,
  clickPerLinkRate,

  messagesChartData,
  templatesChartData,

  cardTones,
  hasOperationalAttentionWarning,
  operationalAttentionTotal,
} = useAnalyticsDerivedData({
  metrics,
  translation,
});

const [isFullLinksListOpen, setIsFullLinksListOpen] = useState(false);
const exportRef = useRef(null);
const [isExportingPdf, setIsExportingPdf] = useState(false);

  const {
  visibleMetricGroups,
  visibleChartSections,
  toggleMetricGroup,
  toggleChartSection,
  resetDashboardView,
} = useDashboardVisibility();
  
  
/**
 * Exporta o relatório Analytics com base nos dados já carregados.
 *
 * Esta função apenas prepara os argumentos necessários.
 * A lógica de geração do PDF fica isolada em analytics.export.js.
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


  return (
   <main
  ref={exportRef}
  data-analytics-pdf-root="true"
  className={styles.page}
                                >
      {/* Cabeçalho da página com título, nota, filtros e botão de refresh */}
       
      <AnalyticsHeader
        translation={translation}
        orgId={orgId}
        period={period}
        onPeriodChange={setPeriod}
        isLoadingMetrics={isLoadingMetrics}
        onRefresh={loadMetrics}
      />

      {/* Mensagem quando não existe organização associada */}
      {!orgId && !authLoading && !orgLoading && (
        <div className={styles.errorBox}>{translation("errors.noOrg")}</div>
      )}

      {/* Mensagem de erro ao carregar dados */}
      {error && <div className={styles.errorBox}>{error}</div>}

      {/* Estado inicial enquanto ainda não há métricas */}
      {!metrics && !error ? (
        <div className={styles.empty}>{translation("loading")}</div>
      ) : null}

      {metrics && (
        <>

      
          
          {/* Grupos principais de cards de métricas */}
          <div data-pdf-section className={styles.metricGroups}>

            <MetricGroup className={styles.review}
              title={translation("groups.overview.title")}
              description={translation("groups.overview.description")}
              
              showLabel={translation("customization.show")}
              hideLabel={translation("customization.hide")}
            >
                

              
              <MetricCard
                icon={Users}
                title={translation("cards.users")}
                value={format(users.total)}
                description={translation("cards.usersHelper", {
                  withAssistant: format(users.withAssistant),
                  withoutAssistant: format(users.withoutAssistant),
                })}
              />

              <MetricCard
                icon={Bot}
                title={translation("cards.assistants")}
                value={format(assistants.total)}
                description={translation("cards.assistantsHelper", {
                  withoutOpenAiId: format(assistants.withoutOpenAiId),
                })}
                tone={cardTones.assistants}
              />

              <MetricCard
                icon={FileText}
                title={translation("cards.templates")}
                value={format(templates.total)}
                description={translation("cards.templatesHelper", {
                  active: format(templates.active),
                  pending: format(templates.pending),
                  rejected: format(templates.rejected),
                })}
                tone={cardTones.templates}
              />

              <MetricCard
                icon={Users}
                title={translation("cards.assistantCoverage")}
                value={`${assistantCoverageRate}%`}
                description={translation("cards.assistantCoverageHelper", {
                  withAssistant: format(users.withAssistant),
                  total: format(users.total),
                })}
                tone={cardTones.assistantCoverage}
              />
            </MetricGroup>

              {/* Barra de personalização da dashboard */}
         
          <div className={styles.dashboardQuickActions}>
            <button
              type="button"
              className={styles.customizationResetButton}
              onClick={resetDashboardView}
            >
              {translation("customization.resetDashboard")}
            </button>

           <button
            type="button"
            className={`${styles.customizationResetButton} ${styles.exportButton}`}
            onClick={handleExportPdf}
            disabled={isExportingPdf || !metrics}
          >
            {isExportingPdf ? "A exportar..." : translation("customization.exports")}
          </button>
          </div>

            <MetricGroup
              title={translation("groups.activity.title")}
              description={translation("groups.activity.description")}
              isVisible={visibleMetricGroups.activity}
              onToggle={() => toggleMetricGroup("activity")}
              showLabel={translation("customization.show")}
              hideLabel={translation("customization.hide")}
            >
              <MetricCard
                icon={MessageSquare}
                title={translation("cards.messages")}
                value={format(messages.total)}
                description={translation("cards.messagesHelper", {
                  whatsapp: format(messages.whatsapp),
                  teams: format(messages.teams),
                })}
              />

              <MetricCard
                icon={CheckCircle2}
                title={translation("cards.delivery")}
                value={format(messages.delivered)}
                description={translation("cards.deliveryHelper", {
                  read: format(messages.read),
                  failed: format(messages.failed),
                })}
                tone={cardTones.delivery}
              />

              <MetricCard
                icon={CheckCircle2}
                title={translation("cards.readRate")}
                value={`${readRate}%`}
                description={translation("cards.readRateHelper", {
                  read: format(messages.read),
                  total: format(messages.total),
                })}
              />

              <MetricCard
                icon={AlertTriangle}
                title={translation("cards.failureRate")}
                value={`${failedMessageRate}%`}
                description={translation("cards.failureRateHelper", {
                  failed: format(messages.failed),
                  total: format(messages.total),
                })}
                tone={cardTones.failureRate}
              />

              <MetricCard
                icon={MessageSquare}
                title={translation("cards.pendingOutreach")}
                value={format(pendingOutreach.total)}
                description={translation("cards.pendingOutreachHelper", {
                  active: format(pendingOutreach.active),
                })}
              />
            </MetricGroup>

            <MetricGroup
              title={translation("groups.automations.title")}
              description={translation("groups.automations.description")}
              isVisible={visibleMetricGroups.automations}
              onToggle={() => toggleMetricGroup("automations")}
              showLabel={translation("customization.show")}
              hideLabel={translation("customization.hide")}
            >
              <MetricCard
                icon={Zap}
                title={translation("cards.automations")}
                value={format(automations.rulesTotal)}
                description={translation("cards.automationsHelper", {
                  active: format(automations.rulesActive),
                  paused: format(automations.rulesPaused),
                })}
              />

              <MetricCard
                icon={Send}
                title={translation("cards.automationRuns")}
                value={format(automations.runsTotal)}
                description={translation("cards.automationRunsHelper", {
                  processed: format(automations.runsProcessed),
                  failed: format(automations.runsFailed),
                })}
                tone={cardTones.automationRuns}
              />

              <MetricCard
                icon={CalendarClock}
                title={translation("cards.scheduledBroadcasts")}
                value={format(scheduledBroadcasts.total)}
                description={translation("cards.scheduledBroadcastsHelper", {
                  queued: format(scheduledBroadcasts.queued),
                  completed: format(scheduledBroadcasts.completed),
                  failed: format(scheduledBroadcasts.failed),
                  recipients: format(scheduledBroadcasts.recipientCount),
                })}
               tone={cardTones.scheduledBroadcasts}
              />
            </MetricGroup>

            <MetricGroup
              title={translation("groups.engagement.title")}
              description={translation("groups.engagement.description")}
              isVisible={visibleMetricGroups.engagement}
              onToggle={() => toggleMetricGroup("engagement")}
              showLabel={translation("customization.show")}
              hideLabel={translation("customization.hide")}
            >
              <MetricCard
                icon={MousePointerClick}
                title={translation("cards.trackedLinks")}
                value={format(trackedLinks.totalClicks)}
                description={translation("cards.trackedLinksHelper", {
                  links: format(trackedLinks.totalLinks),
                })}
              />

              <MetricCard
                icon={MousePointerClick}
                title={translation("cards.clickDensity")}
                value={`${clickPerLinkRate}%`}
                description={translation("cards.clickDensityHelper", {
                  clicks: format(trackedLinks.totalClicks),
                  links: format(trackedLinks.totalLinks),
                })}
              />
            </MetricGroup>

            
          </div>

          {/* Secção de gráficos de distribuição */}
         <section
            data-pdf-section
            className={`${styles.section} ${
              !visibleChartSections.distribution
                ? styles.sectionCollapsed
                : ""
            }`}
          >
            <div className={styles.sectionHeader}>
              <div>
                <div className={styles.titleWithInfo}>
                <h2 className={styles.sectionTitle}>
                  {translation("charts.sectionTitle")}
                </h2>

                <DescriptionInfo text={translation("charts.sectionDescription")} />
              </div>
              </div>

              <button
                type="button"
                className={styles.metricGroupToggle}
                onClick={() => toggleChartSection("distribution")}
              >
                {visibleChartSections.distribution
                  ? translation("customization.hide")
                  : translation("customization.show")}
              </button>
            </div>

            {visibleChartSections.distribution && (
              <div className={styles.distributionChartGrid}>
                

                <ChartCard
                  title={translation("charts.messagesTitle")}
                  description={translation("charts.messagesDescription")}
                  data={messagesChartData}
                />

                <ChartCard
                  title={translation("charts.templatesTitle")}
                  description={translation("charts.templatesDescription")}
                  data={templatesChartData}
                />

              </div>
            )}
          </section>

          {/* Secção de rankings */}
          <div data-pdf-section>
          <TopLinksRanking
            translation={translation}
            topTrackedLinks={topTrackedLinks}
            allTrackedLinks={allTrackedLinks}
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
                    rows={allTrackedLinks}
                    format={format}
                  />

          {/* Secção de gráficos de evolução diária */}
         <section
                data-pdf-section
                className={`${styles.section} ${
                  !visibleChartSections.trends ? styles.sectionCollapsed : ""
                }`}
              >
            <div className={styles.sectionHeader}>
              <div>
               <div className={styles.titleWithInfo}>
                <h2 className={styles.sectionTitle}>
                  {translation("trends.title")}
                </h2>

                <DescriptionInfo text={translation("trends.description")} />
              </div>
              </div>

              <button
                type="button"
                className={styles.metricGroupToggle}
                onClick={() => toggleChartSection("trends")}
              >
                {visibleChartSections.trends
                  ? translation("customization.hide")
                  : translation("customization.show")}
              </button>
            </div>

                {visibleChartSections.trends && (
                <div className={styles.trendChartGrid}>
                  <TrendChartCard
                    title={translation("trends.messagesTitle")}
                    description={translation("trends.messagesDescription")}
                    data={dailyMessagesData}
                    dataKey="messages"
                    locale={locale}
                    emptyMessage={translation("trends.empty")}
                  />

                  <TrendChartCard
                    title={translation("trends.clicksTitle")}
                    description={translation("trends.clicksDescription")}
                    data={dailyClicksData}
                    dataKey="clicks"
                    locale={locale}
                    emptyMessage={translation("trends.empty")}
                  />

                 

                  <TrendChartCard
                    title={translation("trends.automationsTitle")}
                    description={translation("trends.automationsDescription")}
                    data={dailyAutomationRunsData}
                    dataKey="processed"
                    locale={locale}
                    emptyMessage={translation("trends.empty")}
                  />
                </div>
              )}
          </section>

          {/* Resumo operacional final */}
         <div data-pdf-section>
          <OperationalSummary
            translation={translation}
            users={users}
            messages={messages}
            automations={automations}
            scheduledBroadcasts={scheduledBroadcasts}
            templates={templates}
            format={format}
            hasOperationalAttentionWarning={hasOperationalAttentionWarning}
            operationalAttentionTotal={operationalAttentionTotal}
          />
        </div>
        </>
      )}
    </main>
  );
}

