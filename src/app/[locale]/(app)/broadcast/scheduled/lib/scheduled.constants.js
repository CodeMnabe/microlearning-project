/**
 * Constantes da página de broadcasts agendados.
 */

/**
 * Mapa entre nomes usados no frontend e colunas vindas da base de dados.
 *
 * Não tem consumidores neste momento. Mantido porque documenta a
 * correspondência entre a API e a interface.
 */
export const FIELD_MAP = {
  id: "id",
  organizationId: "organization_id",
  payload: "payload",
  channel: "channel",
  scheduledFor: "scheduled_for",
  timezone: "timezone",
  status: "status",
  createdAt: "created_at",
  updatedAt: "updated_at",
  createdBy: "created_by_user_id",
  recipientCount: "recipient_count",
};

/**
 * Estados disponíveis para filtragem na página Scheduled.
 */
export const STATUS_OPTIONS = [
  "all",
  "scheduled",
  "sending",
  "sent",
  "failed",
  "cancelled",
];

/**
 * Canais disponíveis para filtragem.
 */
export const CHANNEL_OPTIONS = ["all", "teams", "whatsapp"];
