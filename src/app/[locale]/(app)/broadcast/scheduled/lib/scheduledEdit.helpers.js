/**
 * Helpers do modal de edição de um broadcast agendado.
 *
 * Transformam utilizadores da organização e destinatários já guardados no
 * modelo usado pelo seletor de destinatários: chave, nome, linha secundária,
 * tipo de contacto e iniciais.
 *
 * Funções puras. Sem React, sem fetch, sem JSX e sem classes de CSS.
 */

import {
  cleanText,
  getRecipientForChannel,
  getRecipientKey,
  getRecipientKind,
  getRecipientSecondary,
  normalizeRecipientForChannel,
} from "./recipient.helpers";

/**
 * Converte um valor em texto apresentável.
 *
 * Aceita texto, número ou objeto de destinatário, testando os campos
 * possíveis por ordem de preferência.
 */
export function normalizeDisplayText(value, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);

  if (!value || typeof value !== "object") return fallback;

  return (
    value.name ||
    value.phoneNumber ||
    value.whatsappUsername ||
    value.whatsappBsuid ||
    value.birdContactId ||
    value.userId ||
    value.email ||
    fallback
  );
}

/**
 * Obtém as iniciais usadas no avatar de um destinatário.
 *
 * Usa a primeira letra dos dois primeiros nomes, ou "?" quando não
 * existe texto.
 */
export function getInitials(value) {
  const text = cleanText(value);
  if (!text) return "?";

  const parts = text.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "?";
  const second = parts.length > 1 ? parts[1]?.[0] : "";

  return `${first}${second}`.toUpperCase();
}

/**
 * Etiqueta do tipo de contacto de um destinatário.
 *
 * Os textos não estão traduzidos, ao contrário do resto da camada.
 */
export function kindLabel(kind) {
  if (kind === "phone") return "Phone";
  if (kind === "bsuid") return "BSUID fallback";
  if (kind === "bird") return "Bird fallback";
  if (kind === "teams") return "Teams";

  return "Recipient";
}

/**
 * Converte um utilizador da organização num candidato do seletor.
 *
 * Devolve `null` quando o utilizador não tem contacto válido para o canal.
 */
export function buildCandidate(orgUser, channel) {
  const payloadRecipient = getRecipientForChannel(orgUser, channel);

  if (!payloadRecipient) return null;

  const key = getRecipientKey(payloadRecipient, channel);

  if (!key) return null;

  const secondary = normalizeDisplayText(
    getRecipientSecondary(orgUser, channel),
    key,
  );

  const name =
    cleanText(orgUser?.name) ||
    cleanText(orgUser?.user) ||
    cleanText(orgUser?.nome) ||
    cleanText(orgUser?.email) ||
    key;

  return {
    ...orgUser,
    key,
    payloadRecipient,
    recipient: payloadRecipient,
    name,
    secondary,
    kind: getRecipientKind(payloadRecipient, channel),
    initials: getInitials(name),
  };
}

/**
 * Converte um destinatário já guardado numa entrada do seletor.
 *
 * Quando corresponde a um utilizador da organização, devolve esse candidato.
 * Caso contrário devolve uma entrada marcada como `unresolved`, para a
 * interface poder sinalizar que já não existe utilizador associado.
 */
export function buildEntry(recipient, candidates, channel) {
  const normalized = normalizeRecipientForChannel(recipient, channel);
  const key = getRecipientKey(normalized, channel);

  if (!normalized || !key) return null;

  const found = candidates.find((candidate) => candidate.key === key);

  if (found) return found;

  const name =
    cleanText(normalized.name) ||
    cleanText(normalized.phoneNumber) ||
    cleanText(normalized.whatsappUsername) ||
    cleanText(normalized.whatsappBsuid) ||
    cleanText(normalized.birdContactId) ||
    cleanText(normalized.email) ||
    cleanText(normalized.userId) ||
    "Unknown recipient";

  const kind = getRecipientKind(normalized, channel);

  const secondary =
    normalized.phoneNumber ||
    normalized.email ||
    normalized.whatsappUsername ||
    normalized.whatsappBsuid ||
    normalized.birdContactId ||
    normalized.userId ||
    "Sem utilizador associado";

  return {
    key,
    payloadRecipient: normalized,
    recipient: normalized,
    name,
    secondary,
    kind,
    initials: getInitials(name),
    unresolved: true,
  };
}
