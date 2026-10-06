/**
 * Link rastreado como botão no WhatsApp: o link sai do texto e vai num
 * botão por baixo do balão, que mostra o nome do link em vez do URL. Sem
 * URL no texto, o WhatsApp também deixa de mostrar o cartão de
 * pré-visualização do site.
 *
 * Este ficheiro não lê variáveis de ambiente, por isso pode ser importado
 * tanto no servidor como no browser: o envio e a pré-visualização do
 * composer decidem com a mesma regra.
 *
 * Formato verificado com o Bird a 06-10-2026 (Channels API): body { type:
 * "text", text: { text, actions: [{ type: "link", link: { text, url } }] } }
 * chega ao WhatsApp como texto com um botão por baixo. O botão abre o mesmo
 * /r/<token> que o link no texto abria, por isso o clique conta igual.
 *
 * Os links dos botões vêm marcados com `button: true` e não precisam de
 * estar no texto; o primeiro vai na mensagem e os outros em balões à parte
 * (planLinkMessages). Mensagens sem marca (agendadas antes disto) usam o
 * primeiro link do texto, como antes.
 */

/* Limites da Meta para o botão de link e para o corpo que o acompanha. */
export const LINK_BUTTON_TEXT_MAX_LENGTH = 20;
export const LINK_BUTTON_BODY_MAX_LENGTH = 1024;

const LINK_PLACEHOLDERS = /\{\{link\.[a-z0-9_-]+\}\}/gi;

function placeholderFor(key) {
  return `{{link.${key}}}`;
}

/*
 * Mensagem só com links rastreados, sem texto à volta. O composer não a
 * deixa enviar no WhatsApp, porque o link vai num botão e uma mensagem com
 * botão precisa de texto. O envio continua a aceitá-la (agendamentos e
 * automações antigos): aí o link segue no texto.
 */
export function isOnlyTrackedLinks(message = "") {
  const text = String(message || "");

  if (!text.match(LINK_PLACEHOLDERS)) return false;

  return text.replace(LINK_PLACEHOLDERS, "").trim() === "";
}

/* Arruma os espaços e as linhas vazias que o link deixa para trás. */
function tidyText(text) {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* O nome do link é o texto do botão, cortado no limite da Meta. */
export function linkButtonText(label) {
  const text = String(label || "").trim();

  if (text.length <= LINK_BUTTON_TEXT_MAX_LENGTH) return text;

  return `${text.slice(0, LINK_BUTTON_TEXT_MAX_LENGTH - 1).trimEnd()}…`;
}

/**
 * O link do botão: o marcado com `button: true` ou, sem nenhum marcado, o
 * primeiro que aparece no texto. Só há um botão de link por mensagem, por
 * isso os outros links ficam no texto. Um link sem nome não serve, porque
 * o botão ficaria sem texto.
 */
export function chooseButtonLink(message = "", trackedLinks = []) {
  const text = String(message || "");
  let first = null;

  for (const link of trackedLinks || []) {
    const key = String(link?.key || "").trim();
    const buttonText = linkButtonText(link?.label);

    if (!key || !buttonText) continue;

    if (link.button === true) return { link, key, buttonText };

    const position = text.indexOf(placeholderFor(key));

    if (position !== -1 && (!first || position < first.position)) {
      first = { link, key, buttonText, position };
    }
  }

  return first
    ? { link: first.link, key: first.key, buttonText: first.buttonText }
    : null;
}

/**
 * Devolve `{ link, buttonText, message }`, com o texto já sem o link do
 * botão, ou null quando o botão não pode ir:
 * - a mensagem tem botões de resposta (quiz, sondagem), que o WhatsApp não
 *   junta com um botão de link;
 * - a mensagem leva imagens: imagem com botão de link não foi verificada
 *   com o Bird;
 * - sem o link não sobra texto, e o WhatsApp exige corpo.
 */
export function pickLinkButton({
  message = "",
  trackedLinks = [],
  hasReplyButtons = false,
  hasImages = false,
} = {}) {
  if (hasReplyButtons || hasImages) return null;

  const chosen = chooseButtonLink(message, trackedLinks);

  if (!chosen) return null;

  const text = String(message || "");
  const placeholder = placeholderFor(chosen.key);
  const rest = text.includes(placeholder)
    ? tidyText(text.split(placeholder).join(""))
    : text.trim();

  if (!rest) return null;

  return {
    link: chosen.link,
    buttonText: chosen.buttonText,
    message: rest,
  };
}

function isButtonLink(link) {
  return (
    link?.button === true &&
    Boolean(String(link?.key || "").trim()) &&
    Boolean(linkButtonText(link?.label))
  );
}

/* Texto do balão à parte: o escrito para ele ou, sem nenhum, o nome. */
function bubbleText(link) {
  const text =
    String(link?.buttonMessage || "").trim() || String(link?.label || "").trim();

  return text.slice(0, LINK_BUTTON_BODY_MAX_LENGTH);
}

function asBubble(link) {
  return { link, buttonText: linkButtonText(link.label), text: bubbleText(link) };
}

/* Todos os links dos botões, cada um no seu balão à parte. */
export function buttonLinkBubbles(trackedLinks = []) {
  return (trackedLinks || []).filter(isButtonLink).map(asBubble);
}

/**
 * Como saem os links marcados como botão no WhatsApp, que só deixa um botão
 * de link por mensagem: o primeiro vai na própria mensagem; cada um dos
 * outros segue num balão à parte, logo a seguir, com o seu texto e o seu
 * botão. Quando a mensagem não pode levar o botão (quiz, imagem), também o
 * primeiro segue num balão à parte.
 *
 * Devolve `{ message, button, extras }`: o texto da mensagem (ainda com
 * placeholders), o botão dela ou null, e os balões à parte, pela ordem dos
 * links. Sem texto nem imagem, o primeiro balão passa a ser a mensagem.
 */
export function planLinkMessages({
  message = "",
  trackedLinks = [],
  hasReplyButtons = false,
  hasImages = false,
} = {}) {
  const picked = pickLinkButton({
    message,
    trackedLinks,
    hasReplyButtons,
    hasImages,
  });

  const extras = (trackedLinks || [])
    .filter((link) => isButtonLink(link) && link !== picked?.link)
    .map(asBubble);

  if (picked) {
    return {
      message: picked.message,
      button: { link: picked.link, buttonText: picked.buttonText },
      extras,
    };
  }

  const text = String(message || "");

  if (!text.trim() && !hasImages && !hasReplyButtons && extras.length) {
    const [first, ...rest] = extras;

    return {
      message: first.text,
      button: { link: first.link, buttonText: first.buttonText },
      extras: rest,
    };
  }

  return { message: text, button: null, extras };
}

/*
 * Corpos dos balões à parte guardados numa mensagem em espera
 * (`payload.followUps`), já com o texto e o botão de cada destinatário.
 */
export function followUpBodies(followUps) {
  return (Array.isArray(followUps) ? followUps : [])
    .filter(
      (item) =>
        String(item?.message || "").trim() &&
        Array.isArray(item?.actions) &&
        item.actions.length > 0,
    )
    .map((item) => ({
      type: "text",
      text: { text: item.message, actions: item.actions },
    }));
}

/*
 * Onde não há botões (Teams), os links marcados como botão vão no fim do
 * texto, um por linha, para chegarem na mesma. Em Markdown mostram o nome.
 */
export function withButtonLinksInText(
  message = "",
  trackedLinks = [],
  { markdown = false } = {},
) {
  const text = String(message || "");

  const lines = (trackedLinks || [])
    .filter(isButtonLink)
    .map((link) => ({ link, placeholder: placeholderFor(link.key.trim()) }))
    .filter(({ placeholder }) => !text.includes(placeholder))
    .map(({ link, placeholder }) =>
      markdown ? `[${String(link.label).trim()}](${placeholder})` : placeholder,
    );

  if (!lines.length) return text;

  const links = lines.join("\n");

  return text.trim() ? `${text.trimEnd()}\n\n${links}` : links;
}

export function buildLinkButtonActions(buttonText, url) {
  return [{ type: "link", link: { text: buttonText, url } }];
}
