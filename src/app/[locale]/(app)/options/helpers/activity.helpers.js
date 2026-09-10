import { AUDIT_AREAS } from "@/lib/audit/auditEvents";

/**
 * Funções puras da página do histórico de atividade.
 */

export const ALL_AREAS = "all";

export const PAGE_SIZE = 25;

/**
 * Opções do filtro de área: "todas" mais uma por área do catálogo.
 */
export function buildAreaOptions(translation) {
  return [
    { value: ALL_AREAS, label: translation("Areas.all") },
    ...AUDIT_AREAS.map((area) => ({
      value: area,
      label: translation(`Areas.${area}`),
    })),
  ];
}

/**
 * Chave de tradução de uma ação: "user.created" -> "Actions.user_created".
 */
export function actionLabelKey(action) {
  if (typeof action !== "string" || !action) return "Actions.unknown";

  return `Actions.${action.replace(/\./g, "_")}`;
}

/**
 * Área de uma linha do histórico, a partir da ação.
 */
export function areaOfAction(action) {
  if (typeof action !== "string") return null;

  const index = action.indexOf(".");

  return index > 0 ? action.slice(0, index) : null;
}

/**
 * Converte o valor de um input type="date" (YYYY-MM-DD) no ISO do
 * início ou do fim desse dia, no fuso horário do browser.
 */
export function dateInputToIso(value, edge = "start") {
  if (typeof value !== "string") return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) return null;

  const [, year, month, day] = match.map(Number);

  const date =
    edge === "end"
      ? new Date(year, month - 1, day, 23, 59, 59, 999)
      : new Date(year, month - 1, day, 0, 0, 0, 0);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

/**
 * Monta a query string da API a partir dos filtros da página.
 */
export function buildQueryString({ orgId, area, from, to, page, pageSize }) {
  const params = new URLSearchParams();

  params.set("orgId", String(orgId));

  if (area && area !== ALL_AREAS) params.set("area", area);

  const fromIso = dateInputToIso(from, "start");
  const toIso = dateInputToIso(to, "end");

  if (fromIso) params.set("from", fromIso);
  if (toIso) params.set("to", toIso);

  params.set("page", String(page || 1));
  params.set("pageSize", String(pageSize || PAGE_SIZE));

  return params.toString();
}

export function formatDateTime(value, locale = "pt") {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * Nome a mostrar para quem fez a ação.
 */
export function actorLabel(item, translation) {
  if (item?.actor_type === "system") return translation("Actor.system");

  return item?.actor_email || translation("Actor.unknown");
}

/**
 * Nome do elemento afetado, com o id como recurso.
 */
export function entityLabel(item) {
  if (item?.entity_label) return item.entity_label;

  if (item?.entity_id) return `#${item.entity_id}`;

  return "-";
}

function has(details, key) {
  return details && details[key] !== undefined && details[key] !== null;
}

/**
 * Resume os detalhes de uma linha numa lista curta de frases,
 * a partir das chaves que as rotas guardam. Chaves desconhecidas
 * são ignoradas para a tabela se manter legível.
 */
export function describeDetails(item, translation, locale = "pt") {
  const details = item?.details;

  if (!details || typeof details !== "object") return [];

  const parts = [];

  if (has(details, "channel")) {
    parts.push(translation(`Channels.${details.channel}`));
  }

  if (Array.isArray(details.fields) && details.fields.length) {
    parts.push(
      translation("Details.fields", {
        count: details.fields.length,
        list: details.fields.join(", "),
      }),
    );
  }

  if (has(details, "recipientCount")) {
    parts.push(
      translation("Details.recipients", { count: details.recipientCount }),
    );
  }

  if (has(details, "ok") && has(details, "failed")) {
    if (typeof details.ok === "number") {
      parts.push(
        translation("Details.result", {
          ok: details.ok,
          failed: details.failed,
        }),
      );
    } else {
      parts.push(
        translation(details.ok ? "Details.delivered" : "Details.notDelivered"),
      );
    }
  } else if (has(details, "ok") && typeof details.ok === "boolean") {
    parts.push(
      translation(details.ok ? "Details.delivered" : "Details.notDelivered"),
    );
  }

  if (has(details, "created") || has(details, "updated")) {
    parts.push(
      translation("Details.imported", {
        created: details.created ?? 0,
        updated: details.updated ?? 0,
        failed: details.failed ?? 0,
      }),
    );
  }

  if (has(details, "count") && !has(details, "created")) {
    parts.push(translation("Details.count", { count: details.count }));
  }

  if (has(details, "op")) {
    parts.push(translation(`Details.tagOps.${details.op}`));
  }

  if (has(details, "fileCount")) {
    parts.push(translation("Details.files", { count: details.fileCount }));
  }

  if (has(details, "storeName")) {
    parts.push(details.storeName);
  }

  if (has(details, "scheduledFor")) {
    parts.push(
      translation("Details.scheduledFor", {
        date: formatDateTime(details.scheduledFor, locale),
      }),
    );
  }

  if (has(details, "status") && typeof details.status === "string") {
    parts.push(translation("Details.status", { status: details.status }));
  }

  if (has(details, "enabled")) {
    parts.push(
      translation(details.enabled ? "Details.enabled" : "Details.disabled"),
    );
  }

  if (has(details, "model")) {
    parts.push(details.model);
  }

  if (has(details, "language") && has(details, "category")) {
    parts.push(`${details.language} · ${details.category}`);
  }

  return parts;
}

export function totalPages(total, pageSize = PAGE_SIZE) {
  if (!total || total <= 0) return 1;

  return Math.max(1, Math.ceil(total / pageSize));
}
