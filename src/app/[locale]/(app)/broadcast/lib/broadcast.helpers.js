



// ==============================
// Base helpers
// ==============================



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

export function makeChainStep(overrides = {}) {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    message: "",
    files: [],
    trackedLinks: [],
    selectedTrackedUrlKey: "",
    delayAfterPreviousReadMinutes: 0,
    ...overrides,
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



// ==============================
// Result helpers
// ==============================



export function getBroadcastCounts(data, fallbackTotal = 0) {
    if (!data || typeof data !== "object") {
      return {
        ok: fallbackTotal,
        failed: 0,
        total: fallbackTotal,
      };
    }

    const results = Array.isArray(data.results) ? data.results : [];

    const ok = Number.isFinite(Number(data.ok))
      ? Number(data.ok)
      : Number.isFinite(Number(data.successes))
        ? Number(data.successes)
        : results.length
          ? results.filter((r) => r.ok).length
          : fallbackTotal;

    const failed = Number.isFinite(Number(data.failed))
      ? Number(data.failed)
      : Number.isFinite(Number(data.failures))
        ? Number(data.failures)
        : results.length
          ? results.length - ok
          : 0;

    return {
      ok,
      failed,
      total: ok + failed,
    };
  }

  export function normalizePhoneDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  export function phonesMatch(a, b) {
    const da = normalizePhoneDigits(a);
    const db = normalizePhoneDigits(b);

    if (!da || !db) return false;

    return da === db || da.endsWith(db) || db.endsWith(da);
  }

 export function getResultReason(result) {
    if (!result) return "Unknown error.";

    if (result.error) return String(result.error);
    if (result.reason) return String(result.reason);

    if (typeof result.data === "string" && result.data.trim()) {
      return result.data.trim();
    }

    if (result.data?.error) return String(result.data.error);
    if (result.data?.message) return String(result.data.message);
    if (result.data?.detail) return String(result.data.detail);

    if (result.status) {
      return `Request failed with status ${result.status}.`;
    }

    return "Unknown error.";
  }

 export  function getFailedRecipients(data, selectedUsers, channel) {
    if (!data || typeof data !== "object") return [];

    const results = Array.isArray(data.results) ? data.results : [];

    return results
      .filter((r) => !r.ok)
      .map((r) => {
        let matchedUser = null;

        if (channel === "teams") {
          matchedUser = selectedUsers.find(
            (u) => String(u.id) === String(r.userId),
          );
        } else {
          matchedUser =
            selectedUsers.find((u) => String(u.id) === String(r.userId)) ||
            selectedUsers.find((u) =>
              phonesMatch(u.phone_number || u.phoneNumber, r.recipient || r.to),
            ) ||
            selectedUsers.find(
              (u) =>
                r.whatsappBsuid &&
                String(u.whatsapp_bsuid || u.whatsappBsuid) ===
                  String(r.whatsappBsuid),
            ) ||
            selectedUsers.find(
              (u) =>
                r.birdContactId &&
                String(u.bird_contact_id || u.birdContactId) ===
                  String(r.birdContactId),
            );
        }

        const fallbackIdentifier =
          r.recipient ||
          r.to ||
          r.whatsappUsername ||
          r.whatsappBsuid ||
          r.birdContactId ||
          r.userId ||
          r.email ||
          "Unknown recipient";

        const label =
          matchedUser?.name ||
          matchedUser?.email ||
          matchedUser?.phone_number ||
          matchedUser?.whatsapp_username ||
          matchedUser?.whatsapp_bsuid ||
          fallbackIdentifier;

        const contact =
          channel === "teams"
            ? matchedUser?.email || r.userId || ""
            : matchedUser?.phone_number ||
              matchedUser?.whatsapp_username ||
              matchedUser?.whatsapp_bsuid ||
              r.to ||
              r.recipient ||
              r.whatsappBsuid ||
              r.birdContactId ||
              "";

        return {
          label,
          contact,
          reason: getResultReason(r),
        };
      });
  }

  export function formatFailedRecipients(failedRecipients, maxToShow = 8) {
    if (!failedRecipients.length) return "";

    const visible = failedRecipients.slice(0, maxToShow);

    const lines = visible.map((r) => {
      const contact =
        r.contact && String(r.contact) !== String(r.label)
          ? ` (${r.contact})`
          : "";

      return `- ${r.label}${contact}: ${r.reason}`;
    });

    const hiddenCount = failedRecipients.length - visible.length;

    if (hiddenCount > 0) {
      lines.push(`- And ${hiddenCount} more...`);
    }

    return `Failed recipients:\n${lines.join("\n")}`;
  }

  export function formatBroadcastResultMessage({
    channel,
    action,
    ok,
    failed,
    note,
    failedRecipients = [],
  }) {
    const channelLabel = channel === "whatsapp" ? "WhatsApp" : "Teams";

    const successLabel = ok === 1 ? "1 success" : `${ok} successes`;
    const failedLabel = failed === 1 ? "1 fail" : `${failed} fails`;

    const mainMessage = `${channelLabel} broadcast ${action} with ${successLabel} and ${failedLabel}.`;
    const failureDetails = formatFailedRecipients(failedRecipients);

    return [mainMessage, note, failureDetails].filter(Boolean).join("\n\n");
  }


  // ==============================
// Read chain helpers
// ==============================


export const MAX_CHAIN_DELAY_MINUTES = 10080; // 7 days
export const MAX_CHAIN_DELAY_HOURS = 168;

 export function splitDelayMinutes(totalMinutes) {
  const total = Number(totalMinutes || 0);

  if (!Number.isFinite(total) || total <= 0) {
    return {
      hours: 0,
      minutes: 0,
    };
  }

  return {
    hours: Math.floor(total / 60),
    minutes: total % 60,
  };
}

export function clampNumber(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) return min;

  return Math.min(Math.max(Math.floor(number), min), max);
}

 export function normalizeDelayMinutes(value) {
    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
      return 0;
    }

    return Math.min(Math.floor(number), MAX_CHAIN_DELAY_MINUTES);
  }

   

export function chainStepDelayValid(step, index) {
    if (index === 0) return true;

    const value = Number(step.delayAfterPreviousReadMinutes || 0);

    return (
      Number.isFinite(value) && value >= 0 && value <= MAX_CHAIN_DELAY_MINUTES
    );
  }

   export function chainStepHasContent(step) {
    return (
      String(step.message || "").trim().length > 0 ||
      (Array.isArray(step.files) && step.files.length > 0)
    );
  }

  export function normalizeTrackedLinksForStep(step) {
    return (step.trackedLinks || [])
      .map((link) => ({
        key: sanitizeTrackedKey(link.key),
        label: String(link.label || "").trim(),
        destinationUrl: String(link.destinationUrl || "").trim(),
      }))
      .filter((link) => link.key && link.label && link.destinationUrl);
  }

  export function trackedLinksValidForStep(step) {
    const normalized = normalizeTrackedLinksForStep(step);

    return (
      normalized.length === (step.trackedLinks || []).length &&
      new Set(normalized.map((link) => link.key)).size === normalized.length
    );
  }
  export function isReadChainValid({
  chainMode,
  readChainsFeatureEnabled,
  channel,
  hasFallbackTemplate,
  chainSteps,
}) {
  if (!chainMode) return true;

  const steps = Array.isArray(chainSteps) ? chainSteps : [];

  return (
    Boolean(readChainsFeatureEnabled) &&
    channel === "whatsapp" &&
    Boolean(hasFallbackTemplate) &&
    steps.length >= 2 &&
    steps.length <= 10 &&
    steps.every(chainStepHasContent) &&
    steps.every(trackedLinksValidForStep) &&
    steps.every(chainStepDelayValid)
  );
}



// ==============================
// Recipients helpers
// ==============================

export function getRecipientLabel(count, translation) {
  return count === 1
    ? `1 ${translation("Broadcast.recipient")}`
    : `${count} ${translation("Broadcast.smallRecipients")}`;
}

export function getChannelLabel(channel) {
  return channel === "whatsapp" ? "WhatsApp" : "Teams";
}

export function normalizeBroadcastUsers(users) {
  return (users || []).map((user) => ({
    ...user,
    id: user.id,
    name: user.name,
    phone_number: user.phone_number ?? user.phoneNumber ?? "",
    whatsapp_bsuid: user.whatsapp_bsuid ?? user.whatsappBsuid ?? "",
    whatsapp_username: user.whatsapp_username ?? user.whatsappUsername ?? "",
    bird_contact_id: user.bird_contact_id ?? user.birdContactId ?? "",
    email: user.email ?? "",
    tagIds: user.tag_ids ?? (user.tags || []).map((tag) => tag.id),
    assistantId: user.assistant_id ?? null,
  }));
}

export function filterBroadcastUsers({
  users,
  query,
  selectedTagIds,
  selectedAssistantIds,
  channel,
}) {
  const term = String(query || "")
    .trim()
    .toLowerCase();

  return (users || []).filter((user) => {
    const textHay = `${user.name || ""} ${user.phone_number || ""} ${
      user.whatsapp_username || ""
    } ${user.whatsapp_bsuid || ""} ${user.email || ""}`.toLowerCase();

    const textOk = !term || textHay.includes(term);

    const tagsOk =
      selectedTagIds.length === 0 ||
      selectedTagIds.every((id) => (user.tagIds || []).includes(id));

    const assistantOk =
      selectedAssistantIds.length === 0 ||
      selectedAssistantIds.includes(user.assistantId);

    const channelOk =
      channel !== "whatsapp" ||
      Boolean(
        user.phone_number ||
          user.whatsapp_bsuid ||
          user.bird_contact_id,
      );

    return channelOk && textOk && tagsOk && assistantOk;
  });
}

// ==============================
// Schedule helpers
// ==============================

export function cleanTimeDraft(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 2);
}

export function validateScheduleTimeParts(hourValue, minuteValue) {
  const rawHour = String(hourValue || "").trim();
  const rawMinute = String(minuteValue || "").trim();

  if (!rawHour || !rawMinute) {
    return {
      ok: false,
      error: "Fill in both hour and minute.",
    };
  }

  if (!/^\d{1,2}$/.test(rawHour) || !/^\d{1,2}$/.test(rawMinute)) {
    return {
      ok: false,
      error: "Use only numbers.",
    };
  }

  const hours = Number(rawHour);
  const minutes = Number(rawMinute);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return {
      ok: false,
      error: "Enter a valid time.",
    };
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return {
      ok: false,
      error: "Enter a valid time.",
    };
  }

  const totalMinutes = hours * 60 + minutes;
  const minMinutes = 8 * 60;
  const maxMinutes = 20 * 60;

  if (totalMinutes < minMinutes || totalMinutes > maxMinutes) {
    return {
      ok: false,
      error: "Choose a time between 08:00 and 20:00.",
    };
  }

  return {
    ok: true,
    error: "",
    hours,
    minutes,
  };
}


export function applyTimeToDate(dateValue, hours, minutes) {
  const next = new Date(dateValue);
  next.setHours(hours, minutes, 0, 0);
  return next;
}


export function isValidDate(dateValue) {
  const date = new Date(dateValue);

  return !Number.isNaN(date.getTime());
}

export function isFutureDate(dateValue, now = Date.now()) {
  const date = new Date(dateValue);

  return isValidDate(date) && date.getTime() > now;
}

export function getScheduledDateFromDraft(dateValue, hourValue, minuteValue) {
  if (!isValidDate(dateValue)) {
    return null;
  }

  const validation = validateScheduleTimeParts(hourValue, minuteValue);

  if (!validation.ok) {
    return null;
  }

  return applyTimeToDate(dateValue, validation.hours, validation.minutes);
}

// ==============================
// Payload helpers
// ==============================

export function buildFallbackTemplatePayload({
  chosenTemplate,
  tplName,
  tplLang,
  paramsComplete,
  orderedParamValues,
  varDefs,
  tplParamsManual,
  needsUrlVar,
  selectedTrackedUrlKey,
}) {
  if (!tplName || !tplLang || !paramsComplete) return null;

  return {
    projectId: chosenTemplate?.projectId,
    name: tplName.trim(),
    languageCode: (tplLang || "pt-PT").trim(),
    params: orderedParamValues,
    varKeys: varDefs.length ? varDefs.map((v) => v.key) : [],
    manualParams: varDefs.length ? undefined : tplParamsManual,
    trackedUrlKey:
      needsUrlVar && selectedTrackedUrlKey ? selectedTrackedUrlKey : null,
  };
}

export function buildWhatsappRecipients(users) {
  return (users || [])
    .filter((user) => user.phone_number || user.whatsapp_bsuid || user.bird_contact_id)
    .map((user) => ({
      userId: user.id,
      name: user.name || null,
      phoneNumber: user.phone_number || null,
      whatsappBsuid: user.whatsapp_bsuid || null,
      whatsappUsername: user.whatsapp_username || null,
      birdContactId: user.bird_contact_id || null,
    }));
}

export function buildTeamsBroadcastPayload({
  orgId,
  users,
  message,
  files,
  trackedLinks,
}) {
  return {
    orgId,
    userIds: (users || []).map((user) => user.id),
    message,
    files,
    trackedLinks,
  };
}

export function buildWhatsappBroadcastPayload({
  orgId,
  users,
  message,
  imageUrls,
  files,
  trackedLinks,
  template,
}) {
  return {
    orgId,
    message,
    imageUrls,
    files,
    trackedLinks,
    recipients: buildWhatsappRecipients(users),
    template,
  };
}

export function buildBroadcastPayload({
  channel,
  orgId,
  users,
  message,
  imageUrls,
  files,
  trackedLinks,
  template,
}) {
  if (channel === "whatsapp") {
    return buildWhatsappBroadcastPayload({
      orgId,
      users,
      message,
      imageUrls,
      files,
      trackedLinks,
      template,
    });
  }

  return buildTeamsBroadcastPayload({
    orgId,
    users,
    message,
    files,
    trackedLinks,
  });
}

export function buildReadChainPayload({
  orgId,
  createdByUserId,
  users,
  fallbackTemplate,
  steps,
}) {
  return {
    orgId,
    createdByUserId,
    channel: "whatsapp",
    fallbackTemplate,
    recipients: buildWhatsappRecipients(users),
    steps: (steps || []).map((step, index) => ({
      message: step.message || "",
      files: Array.isArray(step.files) ? step.files : [],
      trackedLinks: normalizeTrackedLinksForStep(step),
      delayAfterPreviousReadMinutes:
        index === 0
          ? 0
          : normalizeDelayMinutes(step.delayAfterPreviousReadMinutes),
    })),
  };
}

function toScheduleIsoString(dateValue) {
  return dateValue instanceof Date
    ? dateValue.toISOString()
    : new Date(dateValue).toISOString();
}

export function buildScheduledBroadcastPayload({
  orgId,
  createdByUserId,
  channel,
  scheduledDate,
  timezone,
  payload,
  recipientCount,
}) {
  return {
    orgId,
    createdByUserId,
    channel,
    scheduledFor: toScheduleIsoString(scheduledDate),
    timezone,
    payload,
    recipientCount,
  };
}

export function buildScheduledReadChainPayload({
  chainPayload,
  scheduledDate,
  timezone,
}) {
  return {
    ...chainPayload,
    scheduledFor: toScheduleIsoString(scheduledDate),
    timezone,
  };
}


// ==============================
// Upload helpers
// ==============================

export function makeSafeFileName(name) {
  let safe = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  safe = safe.replace(/[^a-zA-Z0-9._-]/g, "_");

  if (!safe) safe = "file";

  return safe;
}

export function makeBroadcastStorageKey(fileName) {
  const safeName = makeSafeFileName(fileName);

  return `broadcasts/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}-${safeName}`;
}

export async function uploadBroadcastFiles({
  supabase,
  files,
  bucket = "images",
}) {
  const uploaded = [];

  for (const file of files || []) {
    const key = makeBroadcastStorageKey(file.name);
    const contentType = file.type || guessContentTypeFromName(file.name);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(key, file, {
        upsert: true,
        contentType,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      throw uploadError;
    }

    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(key);

    if (publicData?.publicUrl) {
      uploaded.push({
        url: publicData.publicUrl,
        name: file.name || makeSafeFileName(file.name),
        contentType: contentType || "application/octet-stream",
      });
    }
  }

  return uploaded;
}



// ==============================
// Template helpers
// ==============================


export function parseManualTemplateParams(manualParams) {
  const map = new Map(
    String(manualParams || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [key, ...rest] = item.split("=");

        return [key.trim(), rest.join("=").trim()];
      }),
  );

  return Array.from(map.values());
}

export function getOrderedTemplateParamValues({
  varDefs,
  varValues,
  manualParams,
}) {
  if (!Array.isArray(varDefs) || varDefs.length === 0) {
    return parseManualTemplateParams(manualParams);
  }

  return varDefs.map((variable) =>
    String(varValues?.[variable.key] ?? "").trim(),
  );
}
export function buildTemplatePreviewVars({
  varDefs,
  varValues,
  sampleRecipient,
  orgName,
  needsUrlVar,
  selectedTrackedUrlKey,
}) {
  const map = {};

  for (const variable of varDefs || []) {
    map[variable.key] = varValues?.[variable.key] ?? "";
  }

  map.recipientName = sampleRecipient?.name || map.name || map.nome || "";
  map.orgName = orgName || map.empresa || map.company || map.organization || "";
  map.urlVar =
    needsUrlVar && selectedTrackedUrlKey
      ? `{{link.${selectedTrackedUrlKey}}}`
      : "";

  return map;
}

export function buildTemplatePreview({ tplDetails, tplLang, previewVars }) {
  if (!tplDetails) {
    return { body: "", buttonText: "", buttonUrl: "" };
  }

  const platformContent =
    (tplDetails.platformContent || []).find(
      (item) => (item.locale || tplDetails.defaultLocale) === tplLang,
    ) || (tplDetails.platformContent || [])[0];

  const blocks = platformContent?.blocks?.length
    ? platformContent.blocks
    : tplDetails.genericContent?.[0]?.blocks || [];

  const bodyRaw = extractText(blocks).join("\n\n");
  const body = interpolate(bodyRaw, previewVars);

  let buttonText = "";
  let buttonUrl = "";

  function scan(node) {
    if (!node) return;

    if (Array.isArray(node)) {
      node.forEach(scan);
      return;
    }

    if (typeof node !== "object") return;

    if (node.action?.type === "link" && node.action.link) {
      buttonText = node.action.link.text || buttonText;
      buttonUrl = node.action.link.url || buttonUrl;
    }

    for (const value of Object.values(node)) {
      scan(value);
    }
  }

  scan(blocks);

  return {
    body,
    buttonText: interpolate(buttonText, previewVars),
    buttonUrl: interpolate(buttonUrl, {
      ...previewVars,
      urlVar: previewVars.urlVar,
    }),
  };
}

export function areTemplateParamsComplete({
  varDefs,
  manualParams,
  orderedParamValues,
}) {
  const hasVariableDefinitions = Array.isArray(varDefs) && varDefs.length > 0;

  if (!hasVariableDefinitions) {
    return String(manualParams || "").trim().length > 0;
  }

  return (orderedParamValues || []).every((value) => value !== "");
}


// ==============================
// Tracked link helpers
// ==============================

export function getTrackedLinkOptions(trackedLinks) {
  return (trackedLinks || [])
    .map((link) => {
      const key = sanitizeTrackedKey(link.key);

      return {
        value: key,
        label: key ? `${key}${link.label ? ` — ${link.label}` : ""}` : "",
      };
    })
    .filter((option) => option.value);
}

export function normalizeComposerTrackedLinks(trackedLinks) {
  return (trackedLinks || [])
    .map((link) => ({
      key: sanitizeTrackedKey(link.key),
      label: String(link.label || "").trim(),
      destinationUrl: String(link.destinationUrl || "").trim(),
    }))
    .filter((link) => link.key && link.label && link.destinationUrl);
}

export function areComposerTrackedLinksValid(trackedLinks) {
  const normalized = normalizeComposerTrackedLinks(trackedLinks);
  const uniqueKeys = new Set(normalized.map((link) => link.key));

  return (
    normalized.length === (trackedLinks || []).length &&
    uniqueKeys.size === normalized.length
  );
}

export function isWhatsappUrlBindingValid({
  needsUrlVar,
  trackedLinkOptions,
  selectedTrackedUrlKey,
}) {
  return (
    !needsUrlVar ||
    (trackedLinkOptions || []).length === 0 ||
    Boolean(selectedTrackedUrlKey)
  );
}