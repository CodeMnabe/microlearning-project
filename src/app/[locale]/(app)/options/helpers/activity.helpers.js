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
 * Traduz uma chave se existir; caso contrário devolve o texto de recurso.
 * O mock de testes do next-intl não tem `has`, e nesse caso devolve a chave.
 */
function translateOr(translation, key, fallback) {
  if (typeof translation?.has === "function" && !translation.has(key)) {
    return fallback;
  }

  return translation(key);
}

function yesNo(value, translation) {
  return translation(value ? "Details.yes" : "Details.no");
}

/**
 * Chaves guardadas só para referência técnica, que não ajudam
 * quem lê o histórico.
 */
const HIDDEN_DETAIL_KEYS = new Set([
  "userIds",
  "tagIds",
  "userId",
  "storeId",
  "assistantId",
  "setting",
  "totalReceived",
  "skipped",
  "projectId",
]);

function fieldName(field, translation) {
  return translateOr(translation, `Details.fieldNames.${field}`, field);
}

/**
 * Converte os detalhes de uma linha numa lista de pares
 * { key, label, value } prontos a mostrar, com etiquetas legíveis.
 *
 * Cada par corresponde a uma linha na coluna de detalhes. Chaves
 * técnicas são escondidas; chaves desconhecidas aparecem com a
 * própria chave como etiqueta, para nada se perder.
 */
export function detailEntries(item, translation, locale = "pt") {
  const details = item?.details;

  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return [];
  }

  const entries = [];
  const consumed = new Set();

  const push = (key, value, labelKey = key) => {
    if (value === undefined || value === null || value === "") return;

    entries.push({
      key,
      label: translation(`Details.labels.${labelKey}`),
      value: String(value),
    });
  };

  const consume = (...keys) => keys.forEach((key) => consumed.add(key));

  if (has(details, "channel")) {
    push("channel", translation(`Channels.${details.channel}`));
    consume("channel");
  }

  if (has(details, "scope")) {
    push(
      "scope",
      translateOr(
        translation,
        `Details.scopes.${details.scope}`,
        details.scope,
      ),
    );
    consume("scope");
  }

  if (has(details, "triggerType") && typeof details.triggerType === "string") {
    push(
      "trigger",
      translateOr(
        translation,
        `Details.triggers.${details.triggerType.replace(/\./g, "_")}`,
        details.triggerType,
      ),
    );
    consume("triggerType");
  }

  if (has(details, "userName")) {
    push("user", details.userName);
    consume("userName");
  }

  if (has(details, "email")) {
    push("email", details.email);
    consume("email");
  }

  if (has(details, "phone")) {
    push("phone", details.phone);
    consume("phone");
  }

  if (has(details, "assistantName")) {
    push("assistant", details.assistantName);
    consume("assistantName");
  }

  if (Array.isArray(details.fields)) {
    const names = [
      ...new Set(details.fields.map((field) => fieldName(field, translation))),
    ];

    push("fields", names.join(", "));
    consume("fields");
  }

  if (has(details, "recipientCount")) {
    push("recipients", details.recipientCount);
    consume("recipientCount");
  }

  if (has(details, "created") || has(details, "updated")) {
    push(
      "result",
      translation("Details.importSummary", {
        created: details.created ?? 0,
        updated: details.updated ?? 0,
        failed: details.failed ?? 0,
      }),
    );
    consume("created", "updated", "failed");
  } else if (typeof details.ok === "number") {
    push(
      "result",
      translation("Details.sendSummary", {
        ok: details.ok,
        failed: details.failed ?? 0,
      }),
    );
    consume("ok", "failed");
  } else if (typeof details.ok === "boolean") {
    push(
      "result",
      translation(details.ok ? "Details.delivered" : "Details.notDelivered"),
    );
    consume("ok", "status");
  }

  if (has(details, "count") && !consumed.has("created")) {
    push("count", details.count);
    consume("count");
  }

  if (has(details, "failedCount") && Number(details.failedCount) > 0) {
    push("failedCount", details.failedCount);
  }
  consume("failedCount");

  if (has(details, "op")) {
    push(
      "operation",
      translateOr(translation, `Details.tagOps.${details.op}`, details.op),
    );
    consume("op");
  }

  if (has(details, "userCount")) {
    push("count", details.userCount);
    consume("userCount");
  }

  if (has(details, "fileCount") || Array.isArray(details.fileNames)) {
    const names = Array.isArray(details.fileNames) ? details.fileNames : [];

    push("files", names.length ? names.join(", ") : (details.fileCount ?? 0));
    consume("fileCount", "fileNames");
  }

  if (has(details, "storeName")) {
    push("store", details.storeName);
    consume("storeName");
  }

  if (has(details, "scheduledFor")) {
    push("scheduledFor", formatDateTime(details.scheduledFor, locale));
    consume("scheduledFor");
  }

  if (has(details, "timezone")) {
    push("timezone", details.timezone);
    consume("timezone");
  }

  if (has(details, "status") && !consumed.has("status")) {
    push(
      "status",
      translateOr(
        translation,
        `Details.statuses.${String(details.status).toLowerCase()}`,
        details.status,
      ),
    );
    consume("status");
  }

  if (has(details, "enabled")) {
    push(
      "enabled",
      translation(details.enabled ? "Details.enabled" : "Details.disabled"),
    );
    consume("enabled");
  }

  if (has(details, "hasTemplate")) {
    push("withTemplate", yesNo(details.hasTemplate, translation));
    consume("hasTemplate");
  }

  if (has(details, "scheduled")) {
    push("scheduled", yesNo(details.scheduled, translation));
    consume("scheduled");
  }

  if (has(details, "automation")) {
    if (details.automation === true) {
      push("source", translation("Details.sourceAutomation"));
    }
    consume("automation");
  }

  if (has(details, "model")) {
    push("model", details.model);
    consume("model");
  }

  if (has(details, "language")) {
    push("language", details.language);
    consume("language");
  }

  if (has(details, "languageCode")) {
    push("language", details.languageCode);
    consume("languageCode");
  }

  if (has(details, "category")) {
    push("category", details.category);
    consume("category");
  }

  if (has(details, "color")) {
    push("color", details.color);
    consume("color");
  }

  if (has(details, "isActive")) {
    push("active", yesNo(details.isActive, translation));
    consume("isActive");
  }

  if (has(details, "stepCount")) {
    push("steps", details.stepCount);
    consume("stepCount");
  }

  if (has(details, "sent")) {
    push("sent", details.sent);
    consume("sent");
  }

  if (has(details, "waitingForReply")) {
    push("waitingForReply", details.waitingForReply);
    consume("waitingForReply");
  }

  if (has(details, "error")) {
    push("error", String(details.error).slice(0, 200));
    consume("error");
  }

  /*
   * O que sobrar aparece com a própria chave como etiqueta,
   * desde que seja um valor simples.
   */
  for (const [key, value] of Object.entries(details)) {
    if (consumed.has(key) || HIDDEN_DETAIL_KEYS.has(key)) continue;

    if (["string", "number", "boolean"].includes(typeof value)) {
      entries.push({
        key,
        label: key,
        value:
          typeof value === "boolean"
            ? yesNo(value, translation)
            : String(value),
      });
    }
  }

  return entries;
}

export function totalPages(total, pageSize = PAGE_SIZE) {
  if (!total || total <= 0) return 1;

  return Math.max(1, Math.ceil(total / pageSize));
}
