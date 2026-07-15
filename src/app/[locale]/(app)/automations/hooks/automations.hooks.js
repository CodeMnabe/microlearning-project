"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useTranslations } from "next-intl";

import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";

import {
  useGlobalLoader,
} from "@/app/LoadingScreen/GlobalLoaderContext";

import {
  useConfirm,
} from "@/app/components/Confirm/ConfirmProvider";

import {
  useAlert,
} from "@/app/components/Alert/AlertProvider";

import {
  AUTOMATION_TABS,
  TRIGGER_DEFINITIONS,
} from "../lib/automations.constants";

import {
  buildAssistantOptions,
  buildAssistantsById,
  buildAutomationRuleInput,
  buildRulesById,
  buildTemplateOptions,
  createAutomationRuleFormState,
  ensureTemplateBindings,
  filterAutomationDeliveries,
  filterAutomationRules,
  filterAutomationRuns,
  getQueueRuns,
  getTemplateOptionValue,
  getTemplateOrder,
  validateAutomationRuleForm,
} from "../lib/automations.helpers";

/**
 * Hook principal da camada Automations.
 *
 * Gere:
 * - autenticação;
 * - organização ativa;
 * - carregamento dos dados;
 * - regras;
 * - runs;
 * - deliveries;
 * - assistentes;
 * - templates;
 * - pesquisa;
 * - tabs;
 * - formulário;
 * - criação;
 * - edição;
 * - ativação;
 * - desativação;
 * - eliminação;
 * - read chains;
 * - execução manual dos crons;
 * - modal.
 *
 * Não deve:
 * - renderizar JSX;
 * - conter estilos;
 * - comunicar diretamente com Supabase;
 * - conter helpers puros extensos.
 */
export function useAutomations() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const {
    org,
    loading: orgLoading,
  } = useOrganization(user);

  const {
    startLoading,
    stopLoading,
  } = useGlobalLoader();

  const confirm = useConfirm();
  const showAlert = useAlert();

  const translation = useTranslations(
    "Automations",
  );

  const modalTranslation = useTranslations(
    "Automations.modal",
  );

  const showAlertRef = useRef(showAlert);

  const [rules, setRules] = useState([]);
  const [runs, setRuns] = useState([]);
  const [materialized, setMaterialized] =
    useState([]);
  const [assistants, setAssistants] =
    useState([]);
  const [templates, setTemplates] =
    useState([]);

  const [query, setQuery] = useState("");

  const [tab, setTab] = useState(
    AUTOMATION_TABS.RULES,
  );

  const [modalOpen, setModalOpen] =
    useState(false);

  const [editingRule, setEditingRule] =
    useState(null);

  const [saving, setSaving] =
    useState(false);

  const [ruleForm, setRuleForm] = useState(
    () => createAutomationRuleFormState(null),
  );

  const [
    readChainsEnabled,
    setReadChainsEnabled,
  ] = useState(false);

  const [
    readChainsSaving,
    setReadChainsSaving,
  ] = useState(false);

  const orgId = org?.id;

  useEffect(() => {
    showAlertRef.current = showAlert;
  }, [showAlert]);

  /**
   * Traduz os triggers.
   */
  const triggerOptions = useMemo(() => {
    return TRIGGER_DEFINITIONS.map(
      (definition) => ({
        ...definition,

        label: translation(
          definition.labelKey,
        ),

        description: translation(
          definition.descriptionKey,
        ),
      }),
    );
  }, [translation]);

  /**
   * Maps usados pelas tabelas e filtros.
   */
  const assistantsById = useMemo(() => {
    return buildAssistantsById(assistants);
  }, [assistants]);

  const rulesById = useMemo(() => {
    return buildRulesById(rules);
  }, [rules]);

  /**
   * Runs ainda visíveis na queue.
   */
  const queueRuns = useMemo(() => {
    return getQueueRuns(runs);
  }, [runs]);

  /**
   * Dados filtrados.
   */
  const filteredRules = useMemo(() => {
    return filterAutomationRules(
      rules,
      query,
    );
  }, [query, rules]);

  const filteredQueueRuns = useMemo(() => {
    return filterAutomationRuns(
      queueRuns,
      query,
      rulesById,
    );
  }, [query, queueRuns, rulesById]);

  const filteredDeliveries = useMemo(() => {
    return filterAutomationDeliveries(
      materialized,
      query,
      rulesById,
    );
  }, [
    materialized,
    query,
    rulesById,
  ]);

  /**
   * Dados derivados do formulário.
   */
  const selectedTemplate = useMemo(() => {
    return (
      templates.find(
        (template) =>
          getTemplateOptionValue(template) ===
          ruleForm.whatsappTemplateId,
      ) || null
    );
  }, [
    ruleForm.whatsappTemplateId,
    templates,
  ]);

  const templateOrder = useMemo(() => {
    return getTemplateOrder(selectedTemplate);
  }, [selectedTemplate]);

  const templateOptions = useMemo(() => {
    return buildTemplateOptions(templates);
  }, [templates]);

  const assistantOptions = useMemo(() => {
    return buildAssistantOptions({
      assistants,

      triggerType: ruleForm.triggerType,

      anyAssistantLabel:
        modalTranslation("anyAssistant"),

      fallbackAssistantLabel:
        modalTranslation(
          "anyAssistantFallback",
        ),
    });
  }, [
    assistants,
    ruleForm.triggerType,
    modalTranslation,
  ]);

  const disabledTrigger = useMemo(() => {
    return Boolean(
      triggerOptions.find(
        (trigger) =>
          trigger.value ===
          ruleForm.triggerType,
      )?.disabled,
    );
  }, [
    ruleForm.triggerType,
    triggerOptions,
  ]);

  const isEditingRule =
    Boolean(editingRule?.id);

  /**
   * Preenche os bindings que ainda não existem
   * sempre que muda o template.
   */
  useEffect(() => {
    if (!templateOrder.length) return;

    setRuleForm((currentForm) => {
      const nextBindings =
        ensureTemplateBindings(
          currentForm.templateBindings,
          templateOrder,
        );

      if (
        nextBindings ===
        currentForm.templateBindings
      ) {
        return currentForm;
      }

      return {
        ...currentForm,
        templateBindings: nextBindings,
      };
    });
  }, [templateOrder]);

  /**
   * Atualiza um campo do formulário.
   */
  const updateRuleFormField = useCallback(
    (field, value) => {
      setRuleForm((currentForm) => ({
        ...currentForm,
        [field]: value,
      }));
    },
    [],
  );

  /**
   * Atualiza todos os bindings do template.
   */
  const updateTemplateBindings =
    useCallback((nextBindings) => {
      setRuleForm((currentForm) => ({
        ...currentForm,
        templateBindings: nextBindings,
      }));
    }, []);

  /**
   * Carrega todos os dados da página.
   */
  const refreshAll = useCallback(
    async (showSuccessAlert = false) => {
      if (!orgId) {
        if (
          showSuccessAlert &&
          typeof showAlertRef.current ===
            "function"
        ) {
          await showAlertRef.current({
            title: translation(
              "alerts.noOrg.title",
            ),

            message: translation(
              "alerts.noOrg.message",
            ),

            tone: "warning",
          });
        }

        return;
      }

      startLoading();

      try {
        const responses = await Promise.all([
          fetch(
            `/api/automations/rules?orgId=${orgId}`,
          ),

          fetch(
            `/api/automations/runs?orgId=${orgId}&limit=100`,
          ),

          fetch(
            `/api/automations/materialized?orgId=${orgId}&limit=100`,
          ),

          fetch(
            `/api/assistants?orgId=${orgId}`,
          ),

          fetch(
            `/api/template/list?orgId=${orgId}`,
          ),

          fetch(
            `/api/organizations/messaging-feature?orgId=${orgId}&channel=whatsapp`,
          ),
        ]);

        const [
          rulesResponse,
          runsResponse,
          materializedResponse,
          assistantsResponse,
          templatesResponse,
          featureResponse,
        ] = responses;

        const [
          rulesData,
          runsData,
          materializedData,
          assistantsData,
          templatesData,
          featureData,
        ] = await Promise.all(
          responses.map((response) =>
            response
              .json()
              .catch(() => ({})),
          ),
        );

        if (!rulesResponse.ok) {
          throw new Error(
            rulesData?.error ||
              "Failed to load automation rules.",
          );
        }

        if (!runsResponse.ok) {
          throw new Error(
            runsData?.error ||
              "Failed to load automation queue.",
          );
        }

        if (!materializedResponse.ok) {
          throw new Error(
            materializedData?.error ||
              "Failed to load automation deliveries.",
          );
        }

        if (!assistantsResponse.ok) {
          throw new Error(
            assistantsData?.error ||
              "Failed to load assistants.",
          );
        }

        if (!templatesResponse.ok) {
          throw new Error(
            templatesData?.error ||
              "Failed to load templates.",
          );
        }

        if (!featureResponse.ok) {
          throw new Error(
            featureData?.error ||
              "Failed to load messaging feature settings.",
          );
        }

        setRules(
          Array.isArray(rulesData?.items)
            ? rulesData.items
            : [],
        );

        setRuns(
          Array.isArray(runsData?.items)
            ? runsData.items
            : [],
        );

        setMaterialized(
          Array.isArray(materializedData?.items)
            ? materializedData.items
            : [],
        );

        setAssistants(
          Array.isArray(assistantsData)
            ? assistantsData
            : [],
        );

        setTemplates(
          Array.isArray(templatesData?.items)
            ? templatesData.items
            : [],
        );

        setReadChainsEnabled(
          Boolean(
            featureData?.item
              ?.read_chains_enabled,
          ),
        );

        if (
          showSuccessAlert &&
          typeof showAlertRef.current ===
            "function"
        ) {
          await showAlertRef.current({
            title: translation(
              "alerts.refreshSuccess.title",
            ),

            message: translation(
              "alerts.refreshSuccess.message",
            ),

            tone: "success",
          });
        }
      } catch (error) {
        console.warn(
          "[Automations] refresh error:",
          error,
        );

        if (
          typeof showAlertRef.current ===
            "function"
        ) {
          await showAlertRef.current({
            title: translation(
              "alerts.loadFailed.title",
            ),

            message: translation(
              "alerts.loadFailed.message",
            ),

            tone: "danger",
          });
        }
      } finally {
        stopLoading();
      }
    },
    [
      orgId,
      startLoading,
      stopLoading,
      translation,
    ],
  );

  /**
   * Carregamento inicial.
   */
  useEffect(() => {
    if (
      authLoading ||
      orgLoading ||
      !orgId
    ) {
      return;
    }

    refreshAll();
  }, [
    authLoading,
    orgLoading,
    orgId,
    refreshAll,
  ]);

  /**
   * Abre o formulário de criação.
   */
  function openCreateRule() {
    setEditingRule(null);

    setRuleForm(
      createAutomationRuleFormState(null),
    );

    setModalOpen(true);
  }

  /**
   * Abre o formulário de edição.
   */
  function openEditRule(rule) {
    setEditingRule(rule);

    setRuleForm(
      createAutomationRuleFormState(rule),
    );

    setModalOpen(true);
  }

  /**
   * Fecha e limpa o modal.
   */
  function closeRuleModal() {
    setModalOpen(false);
    setEditingRule(null);

    setRuleForm(
      createAutomationRuleFormState(null),
    );
  }

  /**
   * Cria ou edita a regra através da API.
   */
  async function saveRule(ruleInput) {
    if (!orgId) {
      await showAlert({
        title: translation(
          "alerts.noOrg.title",
        ),

        message: translation(
          "alerts.noOrg.message",
        ),

        tone: "warning",
      });

      return;
    }

    const {
      id: ruleId,
      ...rulePayload
    } = ruleInput;

    const isEdit = Boolean(ruleId);

    setSaving(true);

    try {
      const endpoint = isEdit
        ? `/api/automations/rules/${ruleId}`
        : "/api/automations/rules";

      const response = await fetch(endpoint, {
        method: isEdit ? "PATCH" : "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          organization_id: orgId,
          ...rulePayload,
        }),
      });

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to save automation rule.",
        );
      }

      closeRuleModal();

      await refreshAll();

      await showAlert({
        title: isEdit
          ? translation(
              "alerts.ruleUpdated.title",
            )
          : translation(
              "alerts.ruleCreated.title",
            ),

        message: isEdit
          ? translation(
              "alerts.ruleUpdated.message",
            )
          : translation(
              "alerts.ruleCreated.message",
            ),

        tone: "success",
      });
    } catch (error) {
      console.warn(
        "[Automations] save rule error:",
        error,
      );

      await showAlert({
        title: translation(
          "alerts.saveRuleError.title",
        ),

        message:
          error.message ||
          translation(
            "alerts.saveRuleError.message",
          ),

        tone: "danger",
      });
    } finally {
      setSaving(false);
    }
  }

  /**
   * Valida e submete o formulário.
   */
  async function submitRuleForm(event) {
    event.preventDefault();

    const validation =
      validateAutomationRuleForm({
        disabledTrigger,

        name: ruleForm.name,

        delayMinutes:
          ruleForm.delayMinutes,

        message: ruleForm.message,

        channel: ruleForm.channel,

        whatsappTemplateId:
          ruleForm.whatsappTemplateId,

        templateOrder,

        templateBindings:
          ruleForm.templateBindings,
      });

    if (!validation.valid) {
      await showAlert({
        title: modalTranslation(
          `alerts.${validation.errorKey}.title`,
        ),

        message: modalTranslation(
          `alerts.${validation.errorKey}.message`,
          validation.values,
        ),

        tone: "warning",
      });

      return;
    }

    const ruleInput =
      buildAutomationRuleInput({
        ruleId: editingRule?.id,

        form: ruleForm,

        parsedDelay:
          validation.parsedDelay,
      });

    await saveRule(ruleInput);
  }

  /**
   * Elimina uma regra.
   */
  async function deleteRule(rule) {
    const confirmed = await confirm({
      title: translation(
        "confirmDelete.title",
        {
          name: rule.name,
        },
      ),

      message: translation(
        "confirmDelete.message",
      ),

      confirmText: translation(
        "confirmDelete.confirm",
      ),

      cancelText: translation(
        "confirmDelete.cancel",
      ),

      tone: "danger",
    });

    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/automations/rules/${rule.id}`,
        {
          method: "DELETE",
        },
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to delete automation rule.",
        );
      }

      await refreshAll();

      await showAlert({
        title: translation(
          "alerts.ruleDeleted.title",
        ),

        message: translation(
          "alerts.ruleDeleted.message",
        ),

        tone: "success",
      });
    } catch (error) {
      console.warn(
        "[Automations] delete rule error:",
        error,
      );

      await showAlert({
        title: translation(
          "alerts.deleteRuleError.title",
        ),

        message:
          error.message ||
          translation(
            "alerts.deleteRuleError.message",
          ),

        tone: "danger",
      });
    }
  }

  /**
   * Ativa ou desativa uma regra.
   */
  async function toggleRule(rule) {
    try {
      const response = await fetch(
        `/api/automations/rules/${rule.id}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            is_active: !rule.is_active,
          }),
        },
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to update automation rule.",
        );
      }

      await refreshAll();
    } catch (error) {
      console.warn(
        "[Automations] toggle rule error:",
        error,
      );

      await showAlert({
        title: translation(
          "alerts.updateRuleError.title",
        ),

        message:
          error.message ||
          translation(
            "alerts.updateRuleError.message",
          ),

        tone: "danger",
      });
    }
  }

  /**
   * Ativa ou desativa as read chains.
   */
  async function toggleReadChainsFeature() {
    if (
      !orgId ||
      readChainsSaving
    ) {
      return;
    }

    const nextEnabled =
      !readChainsEnabled;

    setReadChainsSaving(true);

    try {
      const response = await fetch(
        "/api/organizations/messaging-feature",
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            organizationId: orgId,
            channel: "whatsapp",
            readChainsEnabled: nextEnabled,
          }),
        },
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to update read chains.",
        );
      }

      setReadChainsEnabled(
        Boolean(
          data?.item?.read_chains_enabled,
        ),
      );

      await showAlert({
      title: nextEnabled
        ? translation(
            "alerts.readChainsEnabled.title",
          )
        : translation(
            "alerts.readChainsDisabled.title",
          ),

      message: nextEnabled
        ? translation(
            "alerts.readChainsEnabled.message",
          )
        : translation(
            "alerts.readChainsDisabled.message",
          ),

      tone: "success",
    });
    } catch (error) {
      console.warn(
        "[Automations] read chains error:",
        error,
      );

      await showAlert({
      title: translation(
        "alerts.readChainsUpdateError.title",
      ),

      message: translation(
        "alerts.readChainsUpdateError.message",
      ),

      tone: "danger",
    });
    } finally {
      setReadChainsSaving(false);
    }
  }

  /**
   * Executa manualmente um cron.
   *
   * Será corrigido mais tarde porque o segredo
   * não deve estar disponível no frontend.
   */
  async function runCron(path) {
    try {
      const response = await fetch(path, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          ...(process.env
            .NEXT_PUBLIC_CRON_SECRET
            ? {
                Authorization:
                  `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`,
              }
            : {}),
        },

        body: JSON.stringify({
          limit: 100,
        }),
      });

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error || "Cron failed.",
        );
      }

      await refreshAll();
   } catch (error) {
      console.warn(
        "[Automations] cron error:",
        error,
      );

      await showAlert({
        title: translation(
          "alerts.cronFailed.title",
        ),

        message: translation(
          "alerts.cronFailed.message",
        ),

        tone: "danger",
      });
    }
  }

  return {
    query,
    setQuery,

    tab,
    setTab,

    rules,
    queueRuns,
    materialized,

    filteredRules,
    filteredQueueRuns,
    filteredDeliveries,

    assistants,
    assistantsById,

    templates,
    rulesById,

    triggerOptions,

    modalOpen,
    editingRule,
    isEditingRule,
    saving,

    ruleForm,
    updateRuleFormField,
    updateTemplateBindings,

    templateOrder,
    templateOptions,
    assistantOptions,
    disabledTrigger,

    readChainsEnabled,
    readChainsSaving,

    refreshAll,

    openCreateRule,
    openEditRule,
    closeRuleModal,

    submitRuleForm,

    deleteRule,
    toggleRule,

    toggleReadChainsFeature,

    runInactivity: () =>
      runCron(
        "/api/cron/automations/inactivity",
      ),

    materializeRuns: () =>
      runCron(
        "/api/cron/automations/materialize",
      ),
  };
}