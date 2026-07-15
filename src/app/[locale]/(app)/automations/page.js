"use client";

import styles from "./automations.module.css";

import { AUTOMATION_TABS } from "./lib/automations.constants";
import { useAutomations } from "./hooks/automations.hooks";

import AutomationsToolbar from "./components/AutomationsToolbar";
import AutomationsTabs from "./components/AutomationsTabs";
import AutomationRulesTable from "./components/AutomationRulesTable";
import AutomationQueueTable from "./components/AutomationQueueTable";
import AutomationDeliveriesTable from "./components/AutomationDeliveriesTable";
import ReadChainsFeatureCard from "./components/ReadChainsFeatureCard";
import AutomationRuleModal from "./components/AutomationRuleModal";

/**
 * Página principal da camada Automations.
 *
 * Responsável apenas por:
 * - chamar o hook principal;
 * - compor a interface;
 * - passar dados e callbacks aos componentes.
 *
 * Não deve:
 * - fazer fetches;
 * - gerir regras de negócio;
 * - conter helpers;
 * - gerir diretamente o formulário;
 * - conter lógica extensa de estado.
 */
export default function AutomationsPage() {
  const automations = useAutomations();

  return (
    <div className={styles.usersScreen}>
      <AutomationsToolbar
        query={automations.query}
        onQueryChange={automations.setQuery}
        onRefresh={() => {
          automations.refreshAll(true);
        }}
        onRunInactivity={automations.runInactivity}
        onMaterialize={automations.materializeRuns}
        onCreate={automations.openCreateRule}
      />

      <AutomationsTabs
        activeTab={automations.tab}
        onTabChange={automations.setTab}
        rulesCount={automations.rules.length}
        queueCount={automations.queueRuns.length}
        deliveriesCount={automations.materialized.length}
      />

      {automations.tab === AUTOMATION_TABS.RULES && (
        <AutomationRulesTable
          rules={automations.filteredRules}
          assistantsById={automations.assistantsById}
          triggerOptions={automations.triggerOptions}
          onToggle={automations.toggleRule}
          onEdit={automations.openEditRule}
          onDelete={automations.deleteRule}
        />
      )}

      {automations.tab === AUTOMATION_TABS.QUEUE && (
        <AutomationQueueTable
          runs={automations.filteredQueueRuns}
          ruleMap={automations.rulesById}
          triggerOptions={automations.triggerOptions}
        />
      )}

      {automations.tab === AUTOMATION_TABS.DELIVERIES && (
        <AutomationDeliveriesTable
          deliveries={automations.filteredDeliveries}
          ruleMap={automations.rulesById}
          triggerOptions={automations.triggerOptions}
        />
      )}

      <ReadChainsFeatureCard
        enabled={automations.readChainsEnabled}
        saving={automations.readChainsSaving}
        onToggle={automations.toggleReadChainsFeature}
      />

      <AutomationRuleModal
        open={automations.modalOpen}
        onClose={automations.closeRuleModal}
        onSubmit={automations.submitRuleForm}
        form={automations.ruleForm}
        onFieldChange={automations.updateRuleFormField}
        saving={automations.saving}
        isEdit={automations.isEditingRule}
        disabledTrigger={automations.disabledTrigger}
        triggerOptions={automations.triggerOptions}
        assistantOptions={automations.assistantOptions}
        templateOptions={automations.templateOptions}
        templateOrder={automations.templateOrder}
        onTemplateBindingsChange={
          automations.updateTemplateBindings
        }
      />
    </div>
  );
}