import { AUDIT_AREAS, isKnownAuditAction } from "@/lib/audit/auditEvents";

/**
 * Validação dos parâmetros de consulta do histórico de atividade.
 *
 * Módulo puro: recebe os parâmetros como strings (ou null) e devolve
 * ou os filtros normalizados ou uma mensagem de erro.
 */

export const AUDIT_LOG_DEFAULT_PAGE_SIZE = 25;
export const AUDIT_LOG_MAX_PAGE_SIZE = 100;

const knownAreas = new Set(AUDIT_AREAS);

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function parseIsoDate(value, label) {
  if (isBlank(value)) return { value: null };

  const text = String(value).trim();
  const time = new Date(text).getTime();

  if (Number.isNaN(time)) {
    return { error: `Invalid ${label} date` };
  }

  return { value: new Date(time).toISOString() };
}

function parseIntInRange(value, { label, fallback, min, max }) {
  if (isBlank(value)) return { value: fallback };

  const n = Number(value);

  if (!Number.isInteger(n) || n < min || n > max) {
    return { error: `Invalid ${label}` };
  }

  return { value: n };
}

/**
 * Aceita um objeto simples ou um URLSearchParams.
 */
function readParam(source, key) {
  if (!source) return null;

  if (typeof source.get === "function") {
    return source.get(key);
  }

  return source[key] ?? null;
}

export function parseAuditLogQuery(source) {
  const areaRaw = readParam(source, "area");
  const actionRaw = readParam(source, "action");

  const area = isBlank(areaRaw) ? null : String(areaRaw).trim().toLowerCase();

  if (area && !knownAreas.has(area)) {
    return { error: "Invalid area" };
  }

  const action = isBlank(actionRaw)
    ? null
    : String(actionRaw).trim().toLowerCase();

  if (action && !isKnownAuditAction(action)) {
    return { error: "Invalid action" };
  }

  const from = parseIsoDate(readParam(source, "from"), "from");
  if (from.error) return { error: from.error };

  const to = parseIsoDate(readParam(source, "to"), "to");
  if (to.error) return { error: to.error };

  if (from.value && to.value && from.value > to.value) {
    return { error: "from must be before to" };
  }

  const page = parseIntInRange(readParam(source, "page"), {
    label: "page",
    fallback: 1,
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
  });
  if (page.error) return { error: page.error };

  const pageSize = parseIntInRange(readParam(source, "pageSize"), {
    label: "pageSize",
    fallback: AUDIT_LOG_DEFAULT_PAGE_SIZE,
    min: 1,
    max: AUDIT_LOG_MAX_PAGE_SIZE,
  });
  if (pageSize.error) return { error: pageSize.error };

  return {
    filters: {
      area,
      action,
      from: from.value,
      to: to.value,
      page: page.value,
      pageSize: pageSize.value,
    },
  };
}
