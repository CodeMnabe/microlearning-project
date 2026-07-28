/**
 * Helpers do modal de detalhe de um broadcast agendado.
 *
 * Transformam o payload guardado e o resultado do envio no modelo de dados
 * que o modal apresenta: linhas de destinatário, estado por destinatário,
 * motivo de falha e lista de ficheiros.
 *
 * Funções puras. Sem React, sem fetch, sem JSX e sem classes de CSS.
 * As funções que dependem de estilos ou devolvem ícones ficam no componente.
 *
 * Nota sobre normalização: este ficheiro tem `normalizeUserForLookup` e
 * `normalizeRecipient`, que se parecem com `normalizeUser` e
 * `normalizeRecipientForChannel` de `recipient.helpers`, mas não são
 * equivalentes e não devem ser fundidas:
 *
 * - as daqui servem para APRESENTAR: devolvem sempre a forma completa,
 *   com strings vazias, e preservam o valor original em `raw`/`value`;
 * - as de `recipient.helpers` servem para PERSISTIR: devolvem `null` em
 *   entradas inválidas e acrescentam omissões como "Sem nome".
 */

import {
  cleanText,
  looksLikeWhatsappBsuid,
  phonesMatch,
} from "./recipient.helpers";

/**
 * Traduz uma chave apenas quando existe, caindo no texto alternativo
 * quando a tradução não está definida.
 */
export function safeTranslate(translation, key, fallback) {
  try {
    if (typeof translation?.has === "function") {
      return translation.has(key) ? translation(key) : fallback;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function getItemPayload(item) {
  return item?.payload && typeof item.payload === "object" ? item.payload : {};
}

export function getItemResult(item) {
  if (item?.result && typeof item.result === "object") return item.result;
  if (item?.raw?.result && typeof item.raw.result === "object") {
    return item.raw.result;
  }

  return {};
}

/**
 * Obtém as linhas de resultado do envio.
 *
 * O formato varia com a origem, por isso são testadas várias chaves.
 */
export function getResultRows(item) {
  const result = getItemResult(item);

  if (Array.isArray(result.results)) return result.results;
  if (Array.isArray(result.items)) return result.items;
  if (Array.isArray(result.recipients)) return result.recipients;

  return [];
}

/**
 * Normaliza um utilizador da organização para efeitos de correspondência.
 *
 * Ao contrário de `normalizeUser`, não substitui o nome vazio por um
 * texto alternativo, porque quem escolhe o rótulo é `buildRecipientRows`.
 */
export function normalizeUserForLookup(user = {}) {
  return {
    ...user,
    id: cleanText(user.id),
    name: cleanText(user.name),
    email: cleanText(user.email),
    phoneNumber:
      cleanText(user.phone_number) ||
      cleanText(user.phoneNumber) ||
      cleanText(user.phone),
    whatsappBsuid:
      cleanText(user.whatsapp_bsuid) ||
      cleanText(user.whatsappBsuid) ||
      cleanText(user.whatsappPsuid),
    whatsappUsername:
      cleanText(user.whatsapp_username) || cleanText(user.whatsappUsername),
    birdContactId:
      cleanText(user.bird_contact_id) || cleanText(user.birdContactId),
  };
}

/**
 * Normaliza um destinatário guardado no payload para apresentação.
 *
 * Devolve sempre a forma completa, mesmo com campos vazios, e mantém o
 * valor original. Um destinatário pode vir como objeto ou como texto.
 */
export function normalizeRecipient(raw, channel) {
  if (raw && typeof raw === "object") {
    const recipientValue = cleanText(raw.recipient);
    const toValue = cleanText(raw.to);

    const phoneNumber =
      cleanText(raw.phoneNumber) ||
      cleanText(raw.phone_number) ||
      cleanText(raw.phone) ||
      (!looksLikeWhatsappBsuid(toValue) ? toValue : "") ||
      (!looksLikeWhatsappBsuid(recipientValue) ? recipientValue : "");

    const whatsappBsuid =
      cleanText(raw.whatsappBsuid) ||
      cleanText(raw.whatsapp_bsuid) ||
      cleanText(raw.whatsappPsuid) ||
      (looksLikeWhatsappBsuid(recipientValue) ? recipientValue : "") ||
      (looksLikeWhatsappBsuid(toValue) ? toValue : "");

    return {
      raw,
      userId:
        cleanText(raw.userId) || cleanText(raw.user_id) || cleanText(raw.id),
      name: cleanText(raw.name),
      email: cleanText(raw.email),
      phoneNumber,
      whatsappBsuid: phoneNumber ? "" : whatsappBsuid,
      whatsappUsername: phoneNumber
        ? ""
        : cleanText(raw.whatsappUsername) || cleanText(raw.whatsapp_username),
      birdContactId:
        phoneNumber || whatsappBsuid
          ? ""
          : cleanText(raw.birdContactId) || cleanText(raw.bird_contact_id),
      value: "",
    };
  }

  const value = cleanText(raw);

  if (channel === "teams") {
    return {
      raw,
      userId: value,
      name: "",
      email: "",
      phoneNumber: "",
      whatsappBsuid: "",
      whatsappUsername: "",
      birdContactId: "",
      value,
    };
  }

  return {
    raw,
    userId: "",
    name: "",
    email: "",
    phoneNumber: looksLikeWhatsappBsuid(value) ? "" : value,
    whatsappBsuid: looksLikeWhatsappBsuid(value) ? value : "",
    whatsappUsername: "",
    birdContactId: "",
    value,
  };
}

/**
 * Procura o utilizador da organização correspondente a um destinatário.
 *
 * A correspondência é tentada por id, telefone, BSUID e contacto Bird,
 * nessa ordem.
 */
export function findMatchingUser(recipient, users) {
  return (
    users.find((u) => cleanText(u.id) === cleanText(recipient.userId)) ||
    users.find((u) => phonesMatch(u.phoneNumber, recipient.phoneNumber)) ||
    users.find(
      (u) =>
        recipient.whatsappBsuid &&
        cleanText(u.whatsappBsuid) === cleanText(recipient.whatsappBsuid),
    ) ||
    users.find(
      (u) =>
        recipient.birdContactId &&
        cleanText(u.birdContactId) === cleanText(recipient.birdContactId),
    ) ||
    null
  );
}

/**
 * Procura a linha de resultado correspondente a um destinatário.
 *
 * Quando nenhuma correspondência é encontrada, recorre à posição na lista.
 */
export function findMatchingResult(recipient, index, resultRows) {
  return (
    resultRows.find(
      (r) => cleanText(r.userId) === cleanText(recipient.userId),
    ) ||
    resultRows.find((r) =>
      phonesMatch(r.to || r.recipient, recipient.phoneNumber),
    ) ||
    resultRows.find(
      (r) =>
        recipient.whatsappBsuid &&
        cleanText(r.whatsappBsuid) === cleanText(recipient.whatsappBsuid),
    ) ||
    resultRows.find(
      (r) =>
        recipient.birdContactId &&
        cleanText(r.birdContactId) === cleanText(recipient.birdContactId),
    ) ||
    resultRows[index] ||
    null
  );
}

/**
 * Extrai o motivo de falha de uma linha de resultado.
 */
export function getResultReason(result) {
  if (!result) return "";

  if (result.error) return cleanText(result.error);
  if (result.reason) return cleanText(result.reason);

  if (typeof result.data === "string") return cleanText(result.data);

  return (
    cleanText(result.data?.error) ||
    cleanText(result.data?.message) ||
    cleanText(result.data?.detail) ||
    cleanText(result.message) ||
    cleanText(result.detail) ||
    ""
  );
}

/**
 * Determina o estado de um destinatário.
 *
 * O resultado do envio, quando existe, tem prioridade sobre o estado
 * global do agendamento.
 */
export function getRecipientStatus({ itemStatus, result }) {
  if (result) {
    if (result.ok === true) return "sent";
    if (result.ok === false) return "failed";
  }

  if (["queued", "scheduled"].includes(itemStatus)) return "scheduled";
  if (["processing", "sending"].includes(itemStatus)) return "sending";
  if (itemStatus === "sent") return "sent";
  if (itemStatus === "partial") return "partial";
  if (itemStatus === "failed") return "failed";
  if (itemStatus === "cancelled") return "cancelled";

  return itemStatus || "unknown";
}

/**
 * Constrói as linhas de destinatário apresentadas no modal.
 *
 * Cruza os destinatários do payload com os utilizadores da organização e
 * com o resultado do envio, escolhendo o melhor rótulo disponível.
 *
 * Quando o payload não tem destinatários, são usadas as linhas de resultado.
 */
export function buildRecipientRows(selectedItem, orgUsers) {
  const payload = getItemPayload(selectedItem);
  const resultRows = getResultRows(selectedItem);
  const normalizedUsers = Array.isArray(orgUsers)
    ? orgUsers.map(normalizeUserForLookup)
    : [];

  const rawRecipients = Array.isArray(payload.recipients)
    ? payload.recipients
    : Array.isArray(payload.userIds)
      ? payload.userIds
      : [];

  const sourceRows = rawRecipients.length ? rawRecipients : resultRows;

  return sourceRows.map((raw, index) => {
    const recipient = normalizeRecipient(raw, selectedItem?.channel);
    const matchedUser = findMatchingUser(recipient, normalizedUsers);
    const result = findMatchingResult(recipient, index, resultRows);

    const status = getRecipientStatus({
      itemStatus: selectedItem?.status,
      result,
    });

    const label =
      cleanText(matchedUser?.name) ||
      cleanText(recipient.name) ||
      cleanText(matchedUser?.email) ||
      cleanText(recipient.email) ||
      cleanText(matchedUser?.phoneNumber) ||
      cleanText(recipient.phoneNumber) ||
      cleanText(matchedUser?.whatsappUsername) ||
      cleanText(recipient.whatsappUsername) ||
      cleanText(matchedUser?.whatsappBsuid) ||
      cleanText(recipient.whatsappBsuid) ||
      cleanText(recipient.value) ||
      "Unknown recipient";

    const phoneNumber =
      cleanText(matchedUser?.phoneNumber) || cleanText(recipient.phoneNumber);

    const email = cleanText(matchedUser?.email) || cleanText(recipient.email);

    const whatsappBsuid =
      cleanText(recipient.whatsappBsuid) ||
      cleanText(result?.whatsappBsuid) ||
      (!phoneNumber ? cleanText(matchedUser?.whatsappBsuid) : "");

    const whatsappUsername =
      cleanText(recipient.whatsappUsername) ||
      cleanText(result?.whatsappUsername) ||
      (!phoneNumber ? cleanText(matchedUser?.whatsappUsername) : "");

    const birdContactId =
      cleanText(recipient.birdContactId) ||
      cleanText(result?.birdContactId) ||
      (!phoneNumber && !whatsappBsuid
        ? cleanText(matchedUser?.birdContactId)
        : "");

    return {
      id: `${cleanText(recipient.userId) || label}-${index}`,
      label,
      userId: cleanText(matchedUser?.id) || cleanText(recipient.userId),
      phoneNumber,
      email,
      whatsappBsuid,
      whatsappUsername,
      birdContactId,
      status,
      resultStatusCode: result?.status || null,
      reason: getResultReason(result),
      kind: result?.kind || "",
    };
  });
}

/**
 * Junta os ficheiros do payload com as imagens indicadas apenas por URL.
 *
 * Imagens já presentes na lista de ficheiros não são duplicadas.
 */
export function getFiles(payload) {
  const files = Array.isArray(payload.files) ? payload.files : [];
  const imageUrls = Array.isArray(payload.imageUrls) ? payload.imageUrls : [];

  const imageOnlyFiles = imageUrls
    .filter(Boolean)
    .filter((url) => !files.some((file) => file?.url === url))
    .map((url, index) => ({
      url,
      name: `Image ${index + 1}`,
      contentType: "image/*",
    }));

  return [...files, ...imageOnlyFiles];
}
