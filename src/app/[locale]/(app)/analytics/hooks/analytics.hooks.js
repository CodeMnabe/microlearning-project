"use client";

import { useMemo,useCallback, useEffect, useState } from "react";

import {
  METRIC_GROUP_STORAGE_KEY,
  DEFAULT_VISIBLE_METRIC_GROUPS,
  CHART_SECTION_STORAGE_KEY,
  DEFAULT_VISIBLE_CHART_SECTIONS,
} from "../lib/analytics.constants";

import {
    safeNumber,
  safePercent,
  buildMessagesChartData,
  buildTemplatesChartData,
} from "../lib/analytics.helpers";

// ==============================
// Dashboard visibility hook
// ==============================

export function useDashboardVisibility() {

    // Estado dos grupos de métricas visíveis.
  const [visibleMetricGroups, setVisibleMetricGroups] = useState(
    DEFAULT_VISIBLE_METRIC_GROUPS
  );
    // Estado das secções de gráficos visíveis.
  const [visibleChartSections, setVisibleChartSections] = useState(
    DEFAULT_VISIBLE_CHART_SECTIONS
  );

  /**
   * Carrega do localStorage os grupos de métricas que o utilizador quer ver.
   */
  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(
        METRIC_GROUP_STORAGE_KEY
      );

      if (!storedValue) return;

      const parsedValue = JSON.parse(storedValue);

      setVisibleMetricGroups({
        ...DEFAULT_VISIBLE_METRIC_GROUPS,
        ...parsedValue,
      });
    } catch (err) {
      console.error(
        "[analytics] Failed to load metric group preferences:",
        err
      );
    }
  }, []);

  /**
   * Guarda no localStorage os grupos de métricas visíveis.
   */
  useEffect(() => {
    try {
      window.localStorage.setItem(
        METRIC_GROUP_STORAGE_KEY,
        JSON.stringify(visibleMetricGroups)
      );
    } catch (err) {
      console.error(
        "[analytics] Failed to save metric group preferences:",
        err
      );
    }
  }, [visibleMetricGroups]);

  /**
   * Carrega do localStorage as secções de gráficos que o utilizador quer ver.
   */
  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(
        CHART_SECTION_STORAGE_KEY
      );

      if (!storedValue) return;

      const parsedValue = JSON.parse(storedValue);

      setVisibleChartSections({
        ...DEFAULT_VISIBLE_CHART_SECTIONS,
        ...parsedValue,
      });
    } catch (err) {
      console.error(
        "[analytics] Failed to load chart section preferences:",
        err
      );
    }
  }, []);
/**
   * Guarda no localStorage as secções de gráficos visíveis.
   */
  useEffect(() => {
    try {
      window.localStorage.setItem(
        CHART_SECTION_STORAGE_KEY,
        JSON.stringify(visibleChartSections)
      );
    } catch (err) {
      console.error(
        "[analytics] Failed to save chart section preferences:",
        err
      );
    }
  }, [visibleChartSections]);

  /**
   * Mostra ou oculta um grupo de métricas.
   */
  function toggleMetricGroup(groupKey) {
    setVisibleMetricGroups((currentGroups) => ({
      ...currentGroups,
      [groupKey]: !currentGroups[groupKey],
    }));
  }

  function toggleChartSection(sectionKey) {
    setVisibleChartSections((currentSections) => ({
      ...currentSections,
      [sectionKey]: !currentSections[sectionKey],
    }));
  }

   /**
   * Mostra ou oculta uma secção de gráficos.
   */
  function resetDashboardView() {
    setVisibleMetricGroups({ ...DEFAULT_VISIBLE_METRIC_GROUPS });
    setVisibleChartSections({ ...DEFAULT_VISIBLE_CHART_SECTIONS });
  }

  return {
    visibleMetricGroups,
    visibleChartSections,
    toggleMetricGroup,
    toggleChartSection,
    resetDashboardView,

    
  };
}

// ==============================
// Metrics loading hook
// ==============================

export function useAnalyticsMetrics({
  authLoading,
  orgLoading,
  orgId,
  startLoading,
  stopLoading,
  translation,
}) {

     // Estados principais da dashboard.
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("all");
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

/**
   * Carrega métricas da API para a organização e período atual.
   */
  const loadMetrics = useCallback(async () => {
    if (!orgId) return;

    setError("");
    setIsLoadingMetrics(true);
    startLoading();

    try {
      const res = await fetch(
        `/api/analytics/overview?orgId=${orgId}&period=${period}`,
        {
          cache: "no-store",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load analytics.");
      }

      setMetrics(data);
    } catch (err) {
      console.warn("[Analytics] load error:", err);
      setError(translation("errors.load"));
    } finally {
      setIsLoadingMetrics(false);
      stopLoading();
    }
  }, [orgId, period, startLoading, stopLoading, translation]);

  /**
   * Recarrega as métricas quando a organização ou o período muda.
   */
  useEffect(() => {
    if (authLoading || orgLoading || !orgId) return;

    loadMetrics();
  }, [authLoading, orgLoading, orgId, loadMetrics]);

  return {
    metrics,
    error,
    period,
    setPeriod,
    isLoadingMetrics,
    loadMetrics,
  };
}

// ==============================
// Derived analytics data hook
// ==============================

export function useAnalyticsDerivedData({ metrics, translation }) {
  return useMemo(() => {
     // Dados recebidos da API, separados por grupo.
    const users = metrics?.users ?? {};
    const assistants = metrics?.assistants ?? {};
    const templates = metrics?.templates ?? {};
    const messages = metrics?.messages ?? {};
    const automations = metrics?.automations ?? {};
    const scheduledBroadcasts = metrics?.scheduledBroadcasts ?? {};
    const trackedLinks = metrics?.trackedLinks ?? {};
    const pendingOutreach = metrics?.pendingOutreach ?? {};
    const daily = metrics?.daily ?? {};
    const rankings = metrics?.rankings ?? {};
    // Rankings recebidos da API.
    const topTrackedLinks = rankings.topTrackedLinks ?? [];
    const allTrackedLinks = rankings.topTrackedLinks ?? [];
    // Dados usados nos gráficos diários.
    const dailyMessagesData = daily.messages ?? [];
    const dailyClicksData = daily.clicks ?? [];
    const dailyAutomationRunsData = daily.automationRuns ?? [];
     // Percentagens calculadas para os cards.
    const assistantCoverageRate = safePercent(
      users.withAssistant,
      users.total
    );

    const readRate = safePercent(messages.read, messages.total);

    const failedMessageRate = safePercent(
      messages.failed,
      messages.total
    );

    const clickPerLinkRate = safePercent(
      trackedLinks.totalClicks,
      trackedLinks.totalLinks
    );

    const hasAssistantConfigWarning =
  safeNumber(assistants.withoutOpenAiId) > 0;

const hasRejectedTemplates =
  safeNumber(templates.rejected) > 0;

const hasMessageFailures =
  safeNumber(messages.failed) > 0;

const hasAutomationFailures =
  safeNumber(automations.runsFailed) > 0;

const hasScheduledBroadcastFailures =
  safeNumber(scheduledBroadcasts.failed) > 0;

const operationalAttentionTotal =
  safeNumber(automations.runsFailed) +
  safeNumber(scheduledBroadcasts.failed);

const hasOperationalAttentionWarning = operationalAttentionTotal > 0;

const cardTones = {
  assistants: hasAssistantConfigWarning ? "warning" : "default",
  templates: hasRejectedTemplates ? "warning" : "default",
  assistantCoverage: assistantCoverageRate < 100 ? "warning" : "default",
  delivery: hasMessageFailures ? "warning" : "default",
  failureRate: failedMessageRate > 0 ? "warning" : "default",
  automationRuns: hasAutomationFailures ? "warning" : "default",
  scheduledBroadcasts: hasScheduledBroadcastFailures ? "warning" : "default",
};

    // Dados do gráfico de mensagens por canal.
    const messagesChartData = buildMessagesChartData(messages);
    // Dados do gráfico de estado dos templates.
    const templatesChartData = buildTemplatesChartData(
      templates,
      translation
    );

    return {
  users,
  assistants,
  templates,
  messages,
  automations,
  scheduledBroadcasts,
  trackedLinks,
  pendingOutreach,
  daily,
  rankings,

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
};
  }, [metrics, translation]);
}

// ==============================
// Analytics formatter hook
// ==============================

export function useAnalyticsFormatter(locale) {
    /**
   * Formatador de números de acordo com o idioma atual.
   */
  const formatter = useMemo(() => {
    return new Intl.NumberFormat(locale || "pt-PT");
  }, [locale]);
/**
   * Formata valores numéricos para apresentação.
   */
  const format = useCallback(
    (value) => {
      return formatter.format(safeNumber(value));
    },
    [formatter]
  );

  return {
    formatter,
    format,
  };
}