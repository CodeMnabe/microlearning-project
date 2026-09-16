"use client";

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
import { useTranslations } from "next-intl";

import styles from "../analytics.module.css";

import DashboardQuickActions from "./DashboardQuickActions";
import MetricCard from "./MetricCard";
import MetricGroup from "./MetricGroup";

/**
 * Grupos de cards de métricas da dashboard.
 *
 * Reúne os quatro grupos apresentados no topo: visão geral, atividade,
 * automações e envolvimento.
 *
 * O grupo de visão geral está sempre visível. Os restantes podem ser
 * recolhidos individualmente.
 *
 * As ações rápidas são renderizadas entre o primeiro e o segundo grupo,
 * tal como no desenho original da página.
 */
export default function AnalyticsMetricGroups({
  data,
  format,
  visibleMetricGroups,
  onToggleGroup,
  onResetDashboard,
  onExportPdf,
  onExportExcel,
  isExportingPdf,
  isExportingExcel,
  canExport,
}) {
  const translation = useTranslations("Analytics");

  const {
    users,
    assistants,
    templates,
    messages,
    automations,
    scheduledBroadcasts,
    trackedLinks,
    pendingOutreach,
    assistantCoverageRate,
    readRate,
    failedMessageRate,
    clickPerLinkRate,
    cardTones,
  } = data;

  return (
    <div data-pdf-section className={styles.metricGroups}>
      <MetricGroup
        className={styles.review}
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

      <DashboardQuickActions
        onResetDashboard={onResetDashboard}
        onExportPdf={onExportPdf}
        onExportExcel={onExportExcel}
        isExportingPdf={isExportingPdf}
        isExportingExcel={isExportingExcel}
        canExport={canExport}
      />

      <MetricGroup
        title={translation("groups.activity.title")}
        description={translation("groups.activity.description")}
        isVisible={visibleMetricGroups.activity}
        onToggle={() => onToggleGroup("activity")}
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
        onToggle={() => onToggleGroup("automations")}
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
        onToggle={() => onToggleGroup("engagement")}
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
  );
}
