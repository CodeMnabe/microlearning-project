/**
 * Constantes da administração de templates de WhatsApp.
 */

/**
 * Estados com tradução explícita em `messages/*`.
 *
 * Estados fora deste conjunto são apresentados no formato original.
 */
export const TRANSLATED_TEMPLATE_STATUS_KEYS = new Set([
  "new",
  "active",
  "approved",
  "pending",
  "rejected",
  "paused",
  "disabled",
  "in_appeal",
  "pending_deletion",
  "unknown",
]);
