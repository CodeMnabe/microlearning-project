/**
 * Formatação de texto do WhatsApp: *negrito*, _itálico_, ~riscado~ e
 * ```monoespaçado```. O texto das mensagens é guardado com estes marcadores;
 * o editor mostra-o já formatado e o envio para o Teams converte-o para
 * Markdown (toTeamsMarkdown).
 *
 * Este ficheiro não lê variáveis de ambiente, por isso pode ser importado
 * tanto no servidor como no browser.
 *
 * Regras do WhatsApp para um marcador contar:
 * - abre no início, depois de um espaço ou de pontuação, e com texto logo a
 *   seguir (por isso `* item` é uma lista e `5*3*2` não é negrito);
 * - fecha com texto logo antes, e depois um espaço, pontuação ou o fim (por
 *   isso `nome_completo` não é itálico);
 * - não atravessa linhas, exceto o monoespaçado.
 *
 * Listas (`- `, `* `, `1. `) e citações (`> `) são formatação de linha: ficam
 * como texto, porque é assim que se escrevem no próprio WhatsApp.
 */

const INLINE_MARKERS = {
  "*": "bold",
  _: "italic",
  "~": "strike",
};

const MONO = "```";

const WORD_CHAR = /[\p{L}\p{N}]/u;
const SPACE = /\s/;

function canOpen(text, index) {
  const before = text[index - 1];
  const after = text[index + 1];

  return (
    (before === undefined || !WORD_CHAR.test(before)) &&
    after !== undefined &&
    !SPACE.test(after)
  );
}

function canClose(text, index) {
  const before = text[index - 1];
  const after = text[index + 1];

  return (
    before !== undefined &&
    !SPACE.test(before) &&
    (after === undefined || !WORD_CHAR.test(after))
  );
}

/* Fecho de um marcador na mesma linha, com pelo menos um carácter dentro. */
function findClose(text, open, marker) {
  for (let index = open + 2; index < text.length; index += 1) {
    if (text[index] === "\n") return -1;
    if (text[index] === marker && canClose(text, index)) return index;
  }

  return -1;
}

function pushText(nodes, value) {
  if (!value) return;

  const last = nodes[nodes.length - 1];

  if (last?.type === "text") {
    last.value += value;
  } else {
    nodes.push({ type: "text", value });
  }
}

/**
 * Lê o texto com os marcadores do WhatsApp e devolve uma árvore:
 * `{ type: "text", value }`, `{ type: "mono", value }` ou
 * `{ type: "bold" | "italic" | "strike", children }`.
 */
export function parseWhatsappFormat(text = "") {
  const source = String(text || "");
  const nodes = [];
  let plain = "";
  let index = 0;

  while (index < source.length) {
    if (source.startsWith(MONO, index)) {
      const close = source.indexOf(MONO, index + MONO.length + 1);

      if (close !== -1) {
        pushText(nodes, plain);
        plain = "";
        nodes.push({
          type: "mono",
          value: source.slice(index + MONO.length, close),
        });
        index = close + MONO.length;
        continue;
      }
    }

    const char = source[index];
    const type = INLINE_MARKERS[char];

    if (type && canOpen(source, index)) {
      const close = findClose(source, index, char);

      if (close !== -1) {
        pushText(nodes, plain);
        plain = "";
        nodes.push({
          type,
          children: parseWhatsappFormat(source.slice(index + 1, close)),
        });
        index = close + 1;
        continue;
      }
    }

    plain += char;
    index += 1;
  }

  pushText(nodes, plain);
  return nodes;
}

const WHATSAPP_MARKERS = { bold: "*", italic: "_", strike: "~" };

/* Volta a escrever a árvore com os marcadores do WhatsApp. */
export function formatNodesToText(nodes = []) {
  return nodes
    .map((node) => {
      if (node.type === "text") return node.value;
      if (node.type === "mono") return `${MONO}${node.value}${MONO}`;

      const marker = WHATSAPP_MARKERS[node.type];
      return `${marker}${formatNodesToText(node.children)}${marker}`;
    })
    .join("");
}

/*
 * O que abre e fecha cada formatação no Teams. Itálico e riscado vão em
 * HTML: nas mensagens de bot, o Teams não reconhece `_` nem `~~`, e o
 * itálico em Markdown (`*`) ao lado do negrito (`**`) daria `***`, que é
 * ambíguo.
 */
const TEAMS_MARKERS = {
  bold: ["**", "**"],
  italic: ["<i>", "</i>"],
  strike: ["<s>", "</s>"],
};

function nodesToMarkdown(nodes) {
  return nodes
    .map((node) => {
      if (node.type === "text") return node.value;

      if (node.type === "mono") {
        return node.value.includes("\n")
          ? `${MONO}\n${node.value}\n${MONO}`
          : `\`${node.value}\``;
      }

      const [open, close] = TEAMS_MARKERS[node.type];
      return `${open}${nodesToMarkdown(node.children)}${close}`;
    })
    .join("");
}

/*
 * Converte para o formato do Teams, onde `*texto*` seria itálico: o
 * negrito passa a `**`, o itálico a `<i>`, o riscado a `<s>` e o
 * monoespaçado a código.
 * Listas e citações escrevem-se igual nos dois.
 */
export function toTeamsMarkdown(text = "") {
  return nodesToMarkdown(parseWhatsappFormat(text));
}
