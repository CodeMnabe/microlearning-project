import { COMPANY_KEYS, NAME_KEYS, STATUS_RANK } from "./constants";

export function getInitial(name = "") {
  return (name?.trim()?.[0] || "?").toUpperCase();
}

export function asList(data, preferredKey = "items") {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[preferredKey])) return data[preferredKey];
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.users)) return data.users;
  return [];
}

export function buildInitialScheduledDate() {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return d;
}

export function formatHour(date) {
  return String(date.getHours()).padStart(2, "0");
}

export function formatMinute(date) {
  return String(date.getMinutes()).padStart(2, "0");
}

export function makeTrackedLinkDraft() {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    key: "",
    label: "",
    destinationUrl: "",
  };
}

export const byBestStatus = (a, b) => {
  const ra = STATUS_RANK[a.status] || 0;
  const rb = STATUS_RANK[b.status] || 0;
  if (ra !== rb) return rb - ra;

  const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
  const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
  return tb - ta;
};

export function interpolate(str, values) {
  if (!str) return "";

  return str.replace(/\{\{\s*([.\w-]+)\s*\}\}/g, (_, rawKey) => {
    const k = String(rawKey).toLowerCase();

    if (NAME_KEYS.includes(k)) {
      return values.recipientName ?? values[rawKey] ?? values[k] ?? "";
    }

    if (COMPANY_KEYS.includes(k)) {
      return values.orgName ?? values[rawKey] ?? values[k] ?? "";
    }

    return values[rawKey] ?? values[k] ?? "";
  });
}

export function extractText(node, out = []) {
  if (!node) return out;

  if (Array.isArray(node)) {
    node.forEach((n) => extractText(n, out));
    return out;
  }

  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (
        typeof v === "string" &&
        (k === "text" || k === "title" || k === "content")
      ) {
        out.push(v);
      } else {
        extractText(v, out);
      }
    }
  }

  return out;
}

export function blocksHaveUrlVariable(blocks) {
  const visit = (n) => {
    if (!n) return false;
    if (Array.isArray(n)) return n.some(visit);

    if (typeof n === "object") {
      for (const [k, v] of Object.entries(n)) {
        if (k === "url" && typeof v === "string" && v.includes("{{")) {
          return true;
        }

        if (visit(v)) return true;
      }
    }

    return false;
  };

  return visit(blocks);
}

export function isImageContentType(ct = "") {
  return String(ct).toLowerCase().startsWith("image/");
}

export function isVideoContentType(ct = "") {
  return String(ct).toLowerCase().startsWith("video/");
}

export function guessContentTypeFromName(name = "") {
  const n = String(name || "").toLowerCase();

  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".mp4")) return "video/mp4";
  if (n.endsWith(".mov")) return "video/quicktime";
  if (n.endsWith(".webm")) return "video/webm";

  return "application/octet-stream";
}

export function sanitizeTrackedKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
}

export function replaceTrackedPlaceholders(
  str = "",
  trackedLinks = [],
  channel = "teams",
) {
  let out = String(str || "");

  for (const link of trackedLinks) {
    const placeholder = `{{link.${link.key}}}`;
    const replacement =
      channel === "teams"
        ? `[${link.label || link.key}](${placeholder})`
        : placeholder;

    out = out.split(placeholder).join(replacement);
  }

  return out;
}

export function getWhatsappSubline(user) {
  return (
    user.phone_number ||
    (user.whatsapp_username ? `@${user.whatsapp_username}` : "") ||
    user.whatsapp_bsuid ||
    user.bird_contact_id ||
    ""
  );
}
