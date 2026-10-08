/*
 * Num grupo ou canal, o Teams só envia ao bot as mensagens em que ele é
 * mencionado, e o texto chega com a menção: "<at>MyDigitalBot</at> pergunta".
 * A menção ao bot sai; as menções a outras pessoas ficam só com o nome.
 */

function decodeBasicEntities(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function stripBotMention(activity) {
  let text = typeof activity?.text === "string" ? activity.text : "";
  const botId = activity?.recipient?.id;

  for (const entity of Array.isArray(activity?.entities)
    ? activity.entities
    : []) {
    if (
      entity?.type === "mention" &&
      botId &&
      entity?.mentioned?.id === botId &&
      typeof entity.text === "string" &&
      entity.text
    ) {
      text = text.split(entity.text).join(" ");
    }
  }

  return decodeBasicEntities(text.replace(/<at>(.*?)<\/at>/gi, "$1"))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}
