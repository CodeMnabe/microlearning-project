/**
 * Links rastreados da camada Broadcast.
 *
 * Funções puras. Sem React, sem fetch, sem JSX.
 */

import { makeId } from "./broadcast.base.helpers";
/**
 * Cria um novo draft de link rastreado.
 *
 * O draft representa um link ainda editável pelo utilizador
 * antes de ser normalizado para envio.
 */
export function makeTrackedLinkDraft() {
  return {
    id: makeId(),
    key: "",
    label: "",
    destinationUrl: "",
  };
}

/**
 * Normaliza a key de um link rastreado.
 *
 * A key é usada em placeholders como {{link.exemplo}}.
 * Deve ser segura, previsível e sem caracteres problemáticos.
 */
export function sanitizeTrackedKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
}

/**
 * Substitui placeholders de tracked links no preview da mensagem.
 *
 * No texto real do composer podem existir tokens como {{link.key}}.
 * Para preview, estes tokens são trocados pelo URL correspondente
 * ou por uma representação adequada ao canal.
 */
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

/**
 * Converte tracked links em opções para selects da UI.
 *
 * Usado especialmente quando um template WhatsApp precisa de escolher
 * qual tracked link alimenta o botão URL.
 */
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

/**
 * Normaliza os tracked links antes de envio.
 *
 * Remove drafts incompletos e devolve apenas os dados necessários
 * para o payload final.
 */
export function normalizeComposerTrackedLinks(trackedLinks) {
  return (trackedLinks || [])
    .map((link) => ({
      key: sanitizeTrackedKey(link.key),
      label: String(link.label || "").trim(),
      destinationUrl: String(link.destinationUrl || "").trim(),
    }))
    .filter((link) => link.key && link.label && link.destinationUrl);
}

/**
 * Valida se os tracked links do composer estão completos.
 *
 * Impede links sem key, sem URL ou com keys duplicadas.
 */
export function areComposerTrackedLinksValid(trackedLinks) {
  const normalized = normalizeComposerTrackedLinks(trackedLinks);
  const uniqueKeys = new Set(normalized.map((link) => link.key));

  return (
    normalized.length === (trackedLinks || []).length &&
    uniqueKeys.size === normalized.length
  );
}

/**
 * Valida a ligação entre templates WhatsApp com botão URL
 * e tracked links disponíveis.
 *
 * Quando o template exige uma variável de URL, o utilizador precisa
 * escolher qual tracked link será usado nesse botão.
 */
export function isWhatsappUrlBindingValid({
  needsUrlVar,
  selectedTrackedUrlKey,
}) {
  return !needsUrlVar || Boolean(selectedTrackedUrlKey);
}
