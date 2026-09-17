/**
 * Troca de assistente na conversa do WhatsApp (#132).
 *
 * Um contacto com vários assistentes escreve uma palavra-chave, recebe a
 * lista dos seus assistentes e escolhe um. Até três vão em botões de resposta
 * rápida (limite da Meta); com mais, ou com nomes que ficariam iguais depois
 * de cortados, vai uma lista numerada e o contacto responde com o número.
 *
 * Este ficheiro não lê variáveis de ambiente.
 */

import { QUIZ_MAX_OPTIONS, QUIZ_OPTION_MAX_LENGTH } from "./question";

/* Mensagem inteira, sem acentos nem pontuação, igual a uma destas. */
const SWITCH_KEYWORDS = [
  "assistentes",
  "assistente",
  "trocar assistente",
  "mudar assistente",
  "trocar de assistente",
  "mudar de assistente",
  "assistants",
  "switch assistant",
];

export const SWITCH_KEYWORD = "assistentes";

/* Minutos durante os quais um número ou nome escrito conta como escolha. */
export const SWITCH_MENU_TYPED_MINUTES = 10;

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSwitchKeyword(text) {
  return SWITCH_KEYWORDS.includes(normalize(text));
}

export function assistantButtonLabel(name) {
  const clean = String(name ?? "")
    .replace(/\s+/g, " ")
    .trim();

  return clean.length > QUIZ_OPTION_MAX_LENGTH
    ? `${clean.slice(0, QUIZ_OPTION_MAX_LENGTH - 1).trim()}…`
    : clean;
}

function canUseButtons(assistants) {
  if (assistants.length > QUIZ_MAX_OPTIONS) return false;

  const labels = assistants.map((a) => assistantButtonLabel(a.name));

  return (
    labels.every(Boolean) &&
    new Set(labels.map((label) => label.toLowerCase())).size === labels.length
  );
}

/**
 * Texto e botões do menu. `actions` vem a null quando vai a lista numerada.
 */
export function buildSwitchMenu({ assistants = [], activeId = null }) {
  const active = assistants.find((a) => Number(a.id) === Number(activeId));
  const current = active ? ` Agora estás com ${active.name}.` : "";

  if (canUseButtons(assistants)) {
    return {
      text: `Com que assistente queres falar?${current}`,
      actions: assistants.map((a) => ({
        type: "reply",
        reply: { text: assistantButtonLabel(a.name) },
      })),
    };
  }

  const lines = assistants.map((a, index) => `${index + 1}. ${a.name}`);

  return {
    text: `Com que assistente queres falar?${current} Responde com o número.\n\n${lines.join("\n")}`,
    actions: null,
  };
}

/**
 * Assistente escolhido por um toque num botão do menu, ou por um número ou
 * nome escritos à mão. Devolve null quando não corresponde a nenhum.
 */
export function resolveSwitchChoice({ reply, assistants = [] }) {
  const wanted = normalize(reply?.tappedText || reply?.text);

  if (!wanted) return null;

  const byName = assistants.find(
    (a) =>
      normalize(a.name) === wanted ||
      normalize(assistantButtonLabel(a.name)) === wanted,
  );

  if (byName) return byName;

  if (!reply?.isTap && /^\d+$/.test(wanted)) {
    return assistants[Number(wanted) - 1] ?? null;
  }

  return null;
}

export function switchConfirmationText(assistant, { alreadyActive = false } = {}) {
  const lead = alreadyActive
    ? `Já estás a falar com ${assistant.name}.`
    : `Agora estás a falar com ${assistant.name}.`;

  return `${lead} Para trocar, escreve "${SWITCH_KEYWORD}".`;
}

export function isSwitchMenuFresh(sentAt, now = Date.now()) {
  if (!sentAt) return false;

  const sent = new Date(sentAt).getTime();

  return (
    Number.isFinite(sent) &&
    now - sent <= SWITCH_MENU_TYPED_MINUTES * 60 * 1000
  );
}
