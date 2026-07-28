"use client";

import { useTranslations } from "next-intl";

import styles from "../analytics.module.css";

import ChartCard from "./ChartCard";
import CollapsibleSection from "./CollapsibleSection";

/**
 * Secção de gráficos de distribuição.
 *
 * Apresenta a repartição de mensagens e de templates.
 */
export default function DistributionCharts({
  messagesChartData,
  templatesChartData,
  isVisible,
  onToggle,
}) {
  const translation = useTranslations("Analytics");

  return (
    <CollapsibleSection
      title={translation("charts.sectionTitle")}
      description={translation("charts.sectionDescription")}
      isVisible={isVisible}
      onToggle={onToggle}
      showLabel={translation("customization.show")}
      hideLabel={translation("customization.hide")}
    >
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
    </CollapsibleSection>
  );
}
