/**
 * Helpers puros de Read Chains.
 *
 * Normalizam e validam o pedido antes de o service coordenar repos e envios.
 * Não fazem queries, fetches ou efeitos laterais.
 */

export function normalizeReadChainRecipient(raw) {
  if (!raw || typeof raw !== "object") return null;

  const userId = raw.userId ?? raw.id ?? null;

  if (!userId) return null;

  return {
    ...raw,
    userId,
  };
}

export function normalizeReadChainRecipients(rawRecipients) {
  const recipients = Array.isArray(rawRecipients)
    ? rawRecipients.map(normalizeReadChainRecipient).filter(Boolean)
    : [];

  return Array.from(
    new Map(recipients.map((recipient) => [String(recipient.userId), recipient])).values()
  );
}

export function normalizeDelayMinutes(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }

  return Math.floor(number);
}

export function normalizeReadChainStep(
  step,
  fallbackTemplate = null,
  fallbackWhatsappTemplateId = null
) {
  return {
    message: step?.message || "",
    files: Array.isArray(step?.files) ? step.files : [],
    imageUrls: Array.isArray(step?.imageUrls) ? step.imageUrls : [],
    trackedLinks: Array.isArray(step?.trackedLinks) ? step.trackedLinks : [],
    delayAfterPreviousReadMinutes: normalizeDelayMinutes(
      step?.delayAfterPreviousReadMinutes
    ),
    template: step?.template || fallbackTemplate || null,
    whatsappTemplateId:
      step?.whatsappTemplateId || fallbackWhatsappTemplateId || null,
  };
}

export function normalizeReadChainSteps(
  rawSteps,
  fallbackTemplate = null,
  fallbackWhatsappTemplateId = null
) {
  if (!Array.isArray(rawSteps)) return [];

  return rawSteps.map((step) =>
    normalizeReadChainStep(step, fallbackTemplate, fallbackWhatsappTemplateId)
  );
}

export function stepHasFreeformContent(step) {
  return (
    String(step?.message || "").trim().length > 0 ||
    (Array.isArray(step?.files) && step.files.length > 0) ||
    (Array.isArray(step?.imageUrls) && step.imageUrls.length > 0)
  );
}

export function hasFallbackTemplate({
  fallbackTemplate,
  fallbackWhatsappTemplateId,
  steps,
}) {
  if (fallbackTemplate?.projectId) return true;
  if (fallbackWhatsappTemplateId) return true;

  return Array.isArray(steps) &&
    steps.some(
      (step) => step?.template?.projectId || step?.whatsappTemplateId
    );
}

export function parseReadChainScheduledFor(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("scheduledFor must be a valid date.");
  }

  return date.toISOString();
}

export function findEmptyReadChainStepIndex(steps) {
  return steps.findIndex((step) => !stepHasFreeformContent(step));
}
