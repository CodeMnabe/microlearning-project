import {
  DEFAULT_AUTOMATION_RULE_FORM,
  IN_FLIGHT_QUEUE_STATUSES,
  ORGANIZATION_NAME_TEMPLATE_KEYS,
  USER_NAME_TEMPLATE_KEYS,
} from "./automations.constants";

/**
 * Formata uma data para apresentação.
 */
export function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

/**
 * Converte um valor JSON num objeto.
 */
export function safeJsonParse(value, fallback = {}) {
  if (value == null) return fallback;

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Obtém a mensagem principal de um payload.
 */
export function summarizeMessage(payload) {
  const parsedPayload = safeJsonParse(payload, {});

  return (
    parsedPayload.messageResolved ||
    parsedPayload.message ||
    "-"
  );
}

/**
 * Obtém a mensagem de uma delivery materializada.
 */
export function summarizeMaterializedMessage(item) {
  const scheduledPayload = safeJsonParse(
    item?.scheduled_broadcast?.payload,
    {},
  );

  return (
    scheduledPayload.messageResolved ||
    scheduledPayload.message ||
    summarizeMessage(item?.payload)
  );
}

/**
 * Converte um erro para texto.
 */
export function summarizeError(value) {
  if (!value) return "-";

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Obtém o detalhe principal de um run.
 */
export function summarizeQueueDetails(run) {
  if (run?.last_error) {
    return summarizeError(run.last_error);
  }

  return summarizeMessage(run?.payload);
}

/**
 * Seleciona os runs que ainda pertencem à queue.
 */
export function getQueueRuns(runs = []) {
  return runs.filter(
    (run) =>
      !run.scheduled_broadcast_id ||
      IN_FLIGHT_QUEUE_STATUSES.has(run.status),
  );
}

/**
 * Constrói um Map de regras por ID.
 */
export function buildRulesById(rules = []) {
  return new Map(
    rules.map((rule) => [rule.id, rule]),
  );
}

/**
 * Constrói um Map de assistentes por ID.
 */
export function buildAssistantsById(assistants = []) {
  return new Map(
    assistants.map((assistant) => [
      Number(assistant.id),
      assistant,
    ]),
  );
}

/**
 * Normaliza um valor para pesquisa.
 */
function normalizeSearchValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Filtra regras.
 */
export function filterAutomationRules(
  rules = [],
  query = "",
) {
  const searchTerm = normalizeSearchValue(query);

  if (!searchTerm) return rules;

  return rules.filter((rule) => {
    const payload = safeJsonParse(rule.payload, {});

    const searchableText = [
      rule.name,
      rule.channel,
      rule.trigger_type,
      payload.message,
    ]
      .map(normalizeSearchValue)
      .join(" ");

    return searchableText.includes(searchTerm);
  });
}

/**
 * Filtra runs da queue.
 */
export function filterAutomationRuns(
  runs = [],
  query = "",
  rulesById = new Map(),
) {
  const searchTerm = normalizeSearchValue(query);

  if (!searchTerm) return runs;

  return runs.filter((run) => {
    const rule = rulesById.get(run.rule_id);

    const searchableText = [
      rule?.name,
      run.user_row?.name,
      run.channel,
      run.trigger_type,
      run.status,
      summarizeQueueDetails(run),
    ]
      .map(normalizeSearchValue)
      .join(" ");

    return searchableText.includes(searchTerm);
  });
}

/**
 * Filtra deliveries.
 */
export function filterAutomationDeliveries(
  deliveries = [],
  query = "",
  rulesById = new Map(),
) {
  const searchTerm = normalizeSearchValue(query);

  if (!searchTerm) return deliveries;

  return deliveries.filter((item) => {
    const rule = rulesById.get(item.rule_id);

    const searchableText = [
      rule?.name,
      item.channel,
      item.trigger_type,
      item.status,
      item.user_row?.name,
      item.scheduled_broadcast?.status,
      summarizeMaterializedMessage(item),
    ]
      .map(normalizeSearchValue)
      .join(" ");

    return searchableText.includes(searchTerm);
  });
}

/**
 * Obtém o ID utilizado pelo seletor de templates.
 */
export function getTemplateOptionValue(template) {
  return (
    template?.whatsappTemplateId ||
    template?.id ||
    ""
  );
}

/**
 * Obtém a ordem das variáveis de um template.
 */
export function getTemplateOrder(template) {
  const components = safeJsonParse(
    template?.components,
    {},
  );

  return Array.isArray(components?.order)
    ? components.order
    : [];
}

/**
 * Normaliza uma chave de template.
 */
export function normalizeTemplateKey(key) {
  return String(key || "").toLowerCase();
}

/**
 * Verifica se uma variável representa o nome do utilizador.
 */
export function isUserNameTemplateKey(key) {
  return USER_NAME_TEMPLATE_KEYS.includes(
    normalizeTemplateKey(key),
  );
}

/**
 * Verifica se uma variável representa a organização.
 */
export function isOrganizationNameTemplateKey(key) {
  return ORGANIZATION_NAME_TEMPLATE_KEYS.includes(
    normalizeTemplateKey(key),
  );
}

/**
 * Cria o binding inicial de uma variável.
 */
export function createDefaultTemplateBinding(key) {
  if (isUserNameTemplateKey(key)) {
    return {
      type: "system",
      path: "user.name",
    };
  }

  if (isOrganizationNameTemplateKey(key)) {
    return {
      type: "system",
      path: "organization.name",
    };
  }

  return {
    type: "static",
    value: "",
  };
}

/**
 * Garante que todas as variáveis possuem binding.
 */
export function ensureTemplateBindings(
  currentBindings = {},
  templateOrder = [],
) {
  const nextBindings = {
    ...currentBindings,
  };

  let changed = false;

  templateOrder.forEach((key) => {
    if (!nextBindings[key]) {
      nextBindings[key] =
        createDefaultTemplateBinding(key);

      changed = true;
    }
  });

  return changed
    ? nextBindings
    : currentBindings;
}

/**
 * Cria o estado do formulário a partir de uma regra.
 */
export function createAutomationRuleFormState(
  initialRule,
) {
  const payload = safeJsonParse(
    initialRule?.payload,
    {},
  );

  return {
    name:
      initialRule?.name ??
      DEFAULT_AUTOMATION_RULE_FORM.name,

    triggerType:
      initialRule?.trigger_type ??
      DEFAULT_AUTOMATION_RULE_FORM.triggerType,

    channel:
      initialRule?.channel ??
      DEFAULT_AUTOMATION_RULE_FORM.channel,

    assistantId:
      initialRule?.assistant_id ??
      DEFAULT_AUTOMATION_RULE_FORM.assistantId,

    delayMinutes: String(
      initialRule?.delay_minutes ??
        DEFAULT_AUTOMATION_RULE_FORM.delayMinutes,
    ),

    message:
      payload.message ??
      DEFAULT_AUTOMATION_RULE_FORM.message,

    whatsappTemplateId:
      initialRule?.whatsapp_template_id ??
      DEFAULT_AUTOMATION_RULE_FORM.whatsappTemplateId,

    templateBindings: {
      ...(payload.templateBindings || {}),
    },
  };
}

/**
 * Constrói as opções do seletor de templates.
 */
export function buildTemplateOptions(
  whatsappTemplates = [],
) {
  return whatsappTemplates
    .filter((template) =>
      getTemplateOptionValue(template),
    )
    .map((template) => ({
      value: getTemplateOptionValue(template),

      label: `${template.name} (${
        template.language || "pt-PT"
      })`,
    }));
}

/**
 * Constrói as opções do seletor de assistentes.
 */
export function buildAssistantOptions({
  assistants = [],
  triggerType,
  anyAssistantLabel,
  fallbackAssistantLabel,
}) {
  return [
    {
      value: "",

      label:
        triggerType === "user.inactive"
          ? fallbackAssistantLabel
          : anyAssistantLabel,
    },

    ...assistants.map((assistant) => ({
      value: assistant.id,
      label: assistant.name,
    })),
  ];
}

/**
 * Valida o formulário.
 *
 * Não mostra alerts nem altera estado.
 */
export function validateAutomationRuleForm({
  disabledTrigger,
  name,
  delayMinutes,
  message,
  channel,
  whatsappTemplateId,
  templateOrder = [],
  templateBindings = {},
}) {
  if (disabledTrigger) {
    return {
      valid: false,
      errorKey: "disabledTrigger",
    };
  }

  if (!name.trim()) {
    return {
      valid: false,
      errorKey: "nameRequired",
    };
  }

  const parsedDelay = Number(delayMinutes);

  if (
    !Number.isFinite(parsedDelay) ||
    parsedDelay < 0
  ) {
    return {
      valid: false,
      errorKey: "invalidDelay",
    };
  }

  const hasMessage =
    message.trim().length > 0;

  const hasWhatsappTemplate =
    channel === "whatsapp" &&
    Boolean(whatsappTemplateId);

  if (!hasMessage && !hasWhatsappTemplate) {
    return {
      valid: false,
      errorKey: "contentRequired",
    };
  }

  const missingStaticBindings =
    templateOrder.filter((key) => {
      const binding = templateBindings[key];

      if (!binding) return true;

      if (binding.type !== "static") {
        return false;
      }

      return !String(
        binding.value || "",
      ).trim();
    });

  if (
    channel === "whatsapp" &&
    whatsappTemplateId &&
    missingStaticBindings.length > 0
  ) {
    return {
      valid: false,
      errorKey: "templateBindingsRequired",

      values: {
        fields: missingStaticBindings.join(", "),
      },
    };
  }

  return {
    valid: true,
    parsedDelay,
  };
}

/**
 * Constrói o objeto enviado para a API.
 */
export function buildAutomationRuleInput({
  ruleId,
  form,
  parsedDelay,
}) {
  return {
    id: ruleId,

    name: form.name.trim(),

    trigger_type: form.triggerType,

    channel: form.channel,

    assistant_id:
      form.assistantId === ""
        ? null
        : Number(form.assistantId),

    delay_minutes: parsedDelay,

    payload: {
      message: form.message,
      templateBindings: form.templateBindings,
    },

    whatsapp_template_id:
      form.channel === "whatsapp" &&
      form.whatsappTemplateId
        ? form.whatsappTemplateId
        : null,
  };
}