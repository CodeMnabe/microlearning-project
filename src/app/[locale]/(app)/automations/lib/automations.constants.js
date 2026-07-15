/**
 * Tabs disponíveis na página de Automations.
 */
export const AUTOMATION_TABS = {
  RULES: "rules",
  QUEUE: "queue",
  DELIVERIES: "deliveries",
};

/**
 * Definição funcional dos triggers.
 *
 * Os ícones ficam nos componentes porque são apresentação visual.
 */
export const TRIGGER_DEFINITIONS = [
  {
    value: "user.created",
    labelKey: "userCreated",
    descriptionKey: "triggerDescriptions.userCreated",
  },
  {
    value: "user.inactive",
    labelKey: "userInactive",
    descriptionKey: "triggerDescriptions.userInactive",
  },
  {
    value: "message.read",
    labelKey: "messageRead",
    descriptionKey: "triggerDescriptions.messageRead",
    disabled: true,
  },
  {
    value: "message.unread",
    labelKey: "messageUnread",
    descriptionKey: "triggerDescriptions.messageUnread",
  },
];

/**
 * Canais suportados pelo formulário.
 */
export const CHANNEL_OPTIONS = [
  {
    value: "whatsapp",
    label: "WhatsApp",
  },
  {
    value: "teams",
    label: "Teams",
  },
];

/**
 * Estados que ainda representam queue ou processamento.
 */
export const IN_FLIGHT_QUEUE_STATUSES = new Set([
  "queued",
  "materialized",
  "processing",
]);

/**
 * Estado inicial do formulário.
 */
export const DEFAULT_AUTOMATION_RULE_FORM = {
  name: "",
  triggerType: "user.created",
  channel: "whatsapp",
  assistantId: "",
  delayMinutes: "0",
  message: "",
  whatsappTemplateId: "",
  templateBindings: {},
};

/**
 * Variáveis de template associadas ao utilizador.
 */
export const USER_NAME_TEMPLATE_KEYS = [
  "name",
  "nome",
  "user",
  "user_name",
];

/**
 * Variáveis de template associadas à organização.
 */
export const ORGANIZATION_NAME_TEMPLATE_KEYS = [
  "empresa",
  "company",
  "organization",
  "organizacao",
  "organização",
  "organization_name",
];