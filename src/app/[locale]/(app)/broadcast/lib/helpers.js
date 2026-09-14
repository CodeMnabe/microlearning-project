import { makeEmptyOpenQuestion, makeEmptyQuiz } from "@/lib/whatsapp/question";

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

export function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function makeTrackedLinkDraft() {
  return {
    id: makeId(),
    key: "",
    label: "",
    destinationUrl: "",
  };
}

/*
 * Um passo da cadeia é uma mensagem livre ("message"), um quiz ("quiz") ou
 * uma pergunta aberta ("open"). Guarda os três rascunhos para se poder
 * trocar de tipo sem perder o que já estava escrito.
 */
export const CHAIN_STEP_KINDS = ["message", "quiz", "open"];

export function makeChainStep(overrides = {}) {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: "message",
    message: "",
    files: [],
    trackedLinks: [],
    quiz: makeEmptyQuiz(),
    openQuestion: makeEmptyOpenQuestion(),
    delayAfterPreviousReadMinutes: 0,
    ...overrides,
  };
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

export function formatDelayLabel(minutes, translation) {
  const value = Number(minutes || 0);

  if (!Number.isFinite(value) || value <= 0) {
    return translation("Broadcast.broadcastChain.chainNoDelay");
  }

  const hours = Math.floor(value / 60);
  const remainingMinutes = value % 60;

  if (hours === 0) {
    return translation("Broadcast.broadcastChain.chainDelayMinutes", {
      minutes: remainingMinutes,
    });
  }

  if (remainingMinutes === 0) {
    return translation("Broadcast.broadcastChain.chainDelayHours", {
      hours: hours,
    });
  }

  return translation("Broadcast.broadcastChain.chainDelayMinutesHours", {
    minutes: remainingMinutes,
    hours: hours,
  });
}
