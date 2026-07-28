"use client";

import { useTranslations } from "next-intl";

import styles from "../analytics.module.css";

import CollapsibleSection from "./CollapsibleSection";
import TrendChartCard from "./TrendChartCard";

/**
 * Secção de gráficos de evolução diária.
 *
 * Apresenta a evolução de mensagens, cliques e execuções de automações.
 */
export default function TrendCharts({
  dailyMessagesData,
  dailyClicksData,
  dailyAutomationRunsData,
  locale,
  isVisible,
  onToggle,
}) {
  const translation = useTranslations("Analytics");

  return (
    <CollapsibleSection
      title={translation("trends.title")}
      description={translation("trends.description")}
      isVisible={isVisible}
      onToggle={onToggle}
      showLabel={translation("customization.show")}
      hideLabel={translation("customization.hide")}
    >
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
    </CollapsibleSection>
  );
}
