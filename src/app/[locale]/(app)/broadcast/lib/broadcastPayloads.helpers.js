/**
 * Construção de payloads da camada Broadcast.
 *
 * Funções puras. Sem React, sem fetch, sem JSX.
 */

import {
  normalizeDelayMinutes,
  normalizeTrackedLinksForStep,
} from "./broadcastChains.helpers";
/**
 * Constrói o payload do template fallback WhatsApp.
 *
 * Usado em broadcasts WhatsApp e read chains quando existe template
 * selecionado e os parâmetros estão completos.
 */
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
    varKeys: varDefs.length ? varDefs.map((variable) => variable.key) : [],
    manualParams: varDefs.length ? undefined : tplParamsManual,
    trackedUrlKey:
      needsUrlVar && selectedTrackedUrlKey ? selectedTrackedUrlKey : null,
  };
}

/**
 * Constrói a lista de destinatários WhatsApp para payloads de envio.
 *
 * Remove utilizadores sem dados suficientes para contacto WhatsApp/Bird.
 */
export function buildWhatsappRecipients(users) {
  return (users || [])
    .filter(
      (user) =>
        user.phone_number || user.whatsapp_bsuid || user.bird_contact_id,
    )
    .map((user) => ({
      userId: user.id,
      name: user.name || null,
      phoneNumber: user.phone_number || null,
      whatsappBsuid: user.whatsapp_bsuid || null,
      whatsappUsername: user.whatsapp_username || null,
      birdContactId: user.bird_contact_id || null,
    }));
}

/**
 * Constrói o payload específico para Broadcast Teams.
 */
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

/**
 * Constrói o payload específico para Broadcast WhatsApp.
 */
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

/**
 * Constrói o payload final de um broadcast simples.
 *
 * A estrutura muda conforme o canal:
 * - Teams usa ids de utilizadores;
 * - WhatsApp precisa de dados de contacto compatíveis com envio externo.
 *
 * Esta função não envia nada. Apenas prepara o body para a API.
 */
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

/**
 * Constrói o payload de uma read chain WhatsApp.
 *
 * Inclui destinatários, utilizador criador, template fallback
 * e os steps que compõem a sequência.
 */
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

/**
 * Converte uma data de agendamento para ISO string.
 */
function toScheduleIsoString(dateValue) {
  return dateValue instanceof Date
    ? dateValue.toISOString()
    : new Date(dateValue).toISOString();
}

/**
 * Constrói o payload de agendamento de um broadcast simples.
 *
 * Envolve o payload real de envio com metadados de agendamento,
 * como data, timezone, organização e número de destinatários.
 */
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

/**
 * Constrói o payload de agendamento de uma read chain.
 *
 * A primeira mensagem será enviada na data agendada.
 * As mensagens seguintes dependem das regras da read chain.
 */
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
