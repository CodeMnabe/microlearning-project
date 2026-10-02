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
 * Formato no Bird (Channels API): body { type: "text", text: { text,
 * actions: [{ type: "link", link: { text, url } }] } }. O botão abre o mesmo
 * /r/<token> que o link no texto abria, por isso o clique conta igual.
 */

/* Limites da Meta para o botão de link e para o corpo que o acompanha. */
export const LINK_BUTTON_TEXT_MAX_LENGTH = 20;
export const LINK_BUTTON_BODY_MAX_LENGTH = 1024;

function placeholderFor(key) {
  return `{{link.${key}}}`;
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
 * Escolhe o link rastreado que vai como botão: o primeiro que aparece no
 * texto. Só há um botão de link por mensagem, por isso os outros links
 * ficam no texto.
 *
 * Devolve `{ link, buttonText, message }`, com o texto já sem esse link, ou
 * null quando o link tem de ficar no texto:
 * - a mensagem tem botões de resposta (quiz, sondagem), que o WhatsApp não
 *   junta com um botão de link;
 * - a mensagem leva imagens: imagem com botão de link ainda não foi
 *   verificada com o Bird;
 * - sem o link não sobra texto, e o WhatsApp exige corpo.
 */
export function pickLinkButton({
  message = "",
  trackedLinks = [],
  hasReplyButtons = false,
  hasImages = false,
} = {}) {
  if (hasReplyButtons || hasImages) return null;

  const text = String(message || "");
  let chosen = null;

  for (const link of trackedLinks || []) {
    const key = String(link?.key || "").trim();
    const buttonText = linkButtonText(link?.label);

    if (!key || !buttonText) continue;

    const position = text.indexOf(placeholderFor(key));

    if (position !== -1 && (!chosen || position < chosen.position)) {
      chosen = { link, key, buttonText, position };
    }
  }

  if (!chosen) return null;

  const rest = tidyText(text.split(placeholderFor(chosen.key)).join(""));

  if (!rest) return null;

  return {
    link: chosen.link,
    buttonText: chosen.buttonText,
    message: rest,
  };
}

export function buildLinkButtonActions(buttonText, url) {
  return [{ type: "link", link: { text: buttonText, url } }];
}
