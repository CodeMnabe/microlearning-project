"use client";

import { useTranslations } from "next-intl";

import styles from "../automations.module.css";

/**
 * Tabs disponíveis na página de Automations.
 *
 * A configuração fica fora do componente porque não depende
 * de estado React nem muda durante a execução.
 */
const AUTOMATION_TABS = [
  {
    value: "rules",
    labelKey: "rules",
  },
  {
    value: "queue",
    labelKey: "queue",
  },
  {
    value: "deliveries",
    labelKey: "deliveries",
  },
];

/**
 * Navegação entre regras, fila de execução e entregas.
 *
 * @param {{
 *   activeTab: "rules" | "queue" | "deliveries";
 *   onTabChange: (tab: string) => void;
 *   rulesCount?: number;
 *   queueCount?: number;
 *   deliveriesCount?: number;
 * }} props
 */
export default function AutomationsTabs({
  activeTab,
  onTabChange,
  rulesCount = 0,
  queueCount = 0,
  deliveriesCount = 0,
}) {
  const translation = useTranslations("Automations");

  const tabCounts = {
    rules: rulesCount,
    queue: queueCount,
    deliveries: deliveriesCount,
  };

  return (
    <div className={styles.activeFilters} role="tablist">
      {AUTOMATION_TABS.map((tab) => {
        const isActive = activeTab === tab.value;

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${styles.filterChip} ${
              isActive ? styles.filterChipActive : ""
            }`}
            onClick={() => onTabChange(tab.value)}
          >
            {translation(tab.labelKey)} ({tabCounts[tab.value]})
          </button>
        );
      })}
    </div>
  );
}