/**
 * Troca de assistente na conversa do WhatsApp (#132).
 *
 * Um contacto com vários assistentes escreve uma palavra-chave, recebe a
 * lista dos seus assistentes e escolhe um. Até três vão em botões de resposta
 * rápida; de quatro a dez numa mensagem de lista do WhatsApp (um botão que
 * abre as opções); com mais, ou com nomes que ficariam iguais depois de
 * cortados, vai uma lista numerada e o contacto responde com o número.
 *
 * Mensagem de lista no Bird (verificado a 17-09-2026):
 * body { type: "list", list: { text, altText, items: [{ title, actions:
 * [{ type: "postback", postback: { text, payload } }] }], metadata:
 * { button: { label } } } }. Secções (items dentro de items) são rejeitadas.
 * O toque chega como o de um botão: texto, postback `item_<índice>` e
 * `replyTo.id` igual ao id da mensagem enviada.
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

/* Limites da Meta para a mensagem de lista. */
const LIST_MAX_ITEMS = 10;
const LIST_ITEM_MAX_LENGTH = 24;
const LIST_BUTTON_LABEL = "Ver assistentes";

/* Minutos durante os quais um número ou nome escrito conta como escolha. */
export const SWITCH_MENU_TYPED_MINUTES = 10;

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSwitchKeyword(text) {
  return SWITCH_KEYWORDS.includes(normalize(text));
}

export function assistantButtonLabel(name, maxLength = QUIZ_OPTION_MAX_LENGTH) {
  const clean = String(name ?? "")
    .replace(/\s+/g, " ")
    .trim();

  return clean.length > maxLength
    ? `${clean.slice(0, maxLength - 1).trim()}…`
    : clean;
}

/* Os nomes têm de continuar diferentes depois de cortados ao limite. */
function labelsAreDistinct(assistants, maxLength) {
  const labels = assistants.map((a) => assistantButtonLabel(a.name, maxLength));

  return (
    labels.every(Boolean) &&
    new Set(labels.map((label) => label.toLowerCase())).size === labels.length
  );
}

/**
 * Menu a enviar: `actions` para botões, `list` para a mensagem de lista, e
 * nenhum dos dois quando vai a lista numerada em texto.
 */
export function buildSwitchMenu({ assistants = [], activeId = null }) {
  const active = assistants.find((a) => Number(a.id) === Number(activeId));
  const current = active ? ` Agora estás com ${active.name}.` : "";

  const question = `Com que assistente queres falar?${current}`;

  if (
    assistants.length <= QUIZ_MAX_OPTIONS &&
    labelsAreDistinct(assistants, QUIZ_OPTION_MAX_LENGTH)
  ) {
    return {
      text: question,
      actions: assistants.map((a) => ({
        type: "reply",
        reply: { text: assistantButtonLabel(a.name) },
      })),
      list: null,
    };
  }

  if (
    assistants.length <= LIST_MAX_ITEMS &&
    labelsAreDistinct(assistants, LIST_ITEM_MAX_LENGTH)
  ) {
    return {
      text: question,
      actions: null,
      list: {
        buttonLabel: LIST_BUTTON_LABEL,
        items: assistants.map((a, index) => {
          const title = assistantButtonLabel(a.name, LIST_ITEM_MAX_LENGTH);

          return {
            title,
            actions: [
              {
                type: "postback",
                postback: { text: title, payload: `item_${index}` },
              },
            ],
          };
        }),
      },
    };
  }

  const lines = assistants.map((a, index) => `${index + 1}. ${a.name}`);

  return {
    text: `${question} Responde com o número.\n\n${lines.join("\n")}`,
    actions: null,
    list: null,
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
      normalize(assistantButtonLabel(a.name)) === wanted ||
      normalize(assistantButtonLabel(a.name, LIST_ITEM_MAX_LENGTH)) === wanted,
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
