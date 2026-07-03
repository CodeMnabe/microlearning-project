


/**
 * Helpers da página de broadcasts agendados.
 *
 * Este ficheiro contém funções puras para:
 * - mapear campos vindos da API;
 * - formatar datas e horas;
 * - preparar valores para inputs de data/hora;
 * - normalizar broadcasts agendados para a UI;
 * - validar se um item pode ser editado ou eliminado.
 *
 * Não colocar aqui fetches, estado React, JSX ou chamadas a providers.
 */

/**
 * Mapa entre nomes usados no frontend e colunas vindas da base de dados.
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

/**
 * Encurta texto longo para apresentar em tabelas.
 */

export function previewText(text = "", max = 110) {
  if (!text) return "-";
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

/**
 * Formata uma data/hora respeitando timezone quando disponível.
 */
export function formatDateTime(value, timezone) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }
}

/**
 * Converte uma data para o formato aceite por input type="date".
 */
export function toDateInputValue(value) {
  if (!value) return "";
  const d = new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Extrai hora e minuto de uma data para inputs de edição.
 */
export function toTimeParts(value) {
  if (!value) return { hour: "12", minute: "00" };
  const d = new Date(value);
  return {
    hour: String(d.getHours()).padStart(2, "0"),
    minute: String(d.getMinutes()).padStart(2, "0"),
  };
}

/**
 * Constrói uma data ISO a partir de data, hora e minuto locais.
 */
export function buildScheduledIso(date, hour, minute) {
  if (!date) return null;

  const safeHour = Math.max(0, Math.min(23, Number(hour || 0)));
  const safeMinute = Math.max(0, Math.min(59, Number(minute || 0)));

  const localDate = new Date(`${date}T00:00:00`);
  localDate.setHours(safeHour, safeMinute, 0, 0);

  return localDate.toISOString();
}

function normalizeStatus(status = "") {
  const value = String(status || "").toLowerCase();
  if (value === "queued") return "scheduled";
  if (value === "processing") return "sending";
  return value || "scheduled";
}

function getPayloadMessage(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;

  return (
    payload.message ??
    payload.text ??
    payload.body ??
    payload.content ??
    payload.caption ??
    ""
  );
}

/**
 * Normaliza um broadcast agendado vindo da API para o formato da UI.
 */
export function normalizeBroadcast(row) {
  const payload = row?.[FIELD_MAP.payload] ?? null;

  return {
    id: row?.[FIELD_MAP.id],
    message: getPayloadMessage(payload),
    channel: String(row?.[FIELD_MAP.channel] ?? "teams").toLowerCase(),
    scheduledFor: row?.[FIELD_MAP.scheduledFor] ?? null,
    timezone: row?.[FIELD_MAP.timezone] ?? "Europe/Lisbon",
    status: normalizeStatus(row?.[FIELD_MAP.status]),
    createdAt: row?.[FIELD_MAP.createdAt] ?? null,
    updatedAt: row?.[FIELD_MAP.updatedAt] ?? null,
    createdBy: row?.[FIELD_MAP.createdBy] ?? null,
    recipientsCount: row?.[FIELD_MAP.recipientCount] ?? null,
    payload,
    raw: row,
  };
}

/**
 * Indica se um broadcast ainda pode ser editado.
 *
 * Broadcasts em envio ou já enviados não devem ser alterados.
 */
export function canEditItem(item) {
  return !["sending", "sent"].includes(item.status);
}

/**
 * Indica se um broadcast ainda pode ser eliminado.
 *
 * Broadcasts em envio ou já enviados não devem ser removidos.
 */
export function canDeleteItem(item) {
  return !["sending", "sent"].includes(item.status);
}
