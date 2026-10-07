/*
 * Formatação de linha do WhatsApp: listas e citação são prefixos no início
 * de cada linha ("- ", "1. ", "> "). A lista de tarefas não existe no
 * WhatsApp; usa o quadrado "☐", que aparece igual em qualquer telemóvel e
 * no Teams.
 *
 * Tudo aqui trabalha só com texto, para se poder testar sem o balão.
 */

const LIST_PREFIX = /^(- |\* |\d+\. |☐ )/;
const QUOTE_PREFIX = /^> /;
const NUMBERED = /^\d+\. /;

export const LINE_KINDS = {
  bullet: { test: /^[-*] /, strip: LIST_PREFIX, prefix: () => "- " },
  numbered: { test: NUMBERED, strip: LIST_PREFIX, prefix: (n) => `${n}. ` },
  task: { test: /^☐ /, strip: LIST_PREFIX, prefix: () => "☐ " },
  quote: { test: QUOTE_PREFIX, strip: QUOTE_PREFIX, prefix: () => "> " },
};

/* Que lista é esta linha (bullet, numbered ou task), ou null. */
function listKindOf(line) {
  return (
    ["bullet", "numbered", "task"].find((kind) =>
      LINE_KINDS[kind].test.test(line),
    ) || null
  );
}

/*
 * Numera de novo (1, 2, 3...) as listas numeradas que tocam nas linhas que
 * mudaram, como o Teams: um item novo a meio empurra os seguintes, e uma
 * lista partida em duas recomeça no 1. As outras listas do texto ficam como
 * estão (uma linha como "2026. Ano novo" não é para mexer).
 */
function renumberLists(lines, firstLine, lastLine) {
  let index = 0;

  while (index < lines.length) {
    if (!NUMBERED.test(lines[index])) {
      index += 1;
      continue;
    }

    const start = index;
    while (index < lines.length && NUMBERED.test(lines[index])) index += 1;

    if (index - 1 >= firstLine - 1 && start <= lastLine + 1) {
      for (let line = start; line < index; line += 1) {
        lines[line] = lines[line].replace(NUMBERED, `${line - start + 1}. `);
      }
    }
  }

  return lines;
}

/* Onde fica o cursor depois de mudar o texto: linha e coluna. */
function result(lines, line, column) {
  return { text: lines.join("\n"), line, column };
}

/*
 * Põe ou tira o prefixo de linha (lista ou citação) nas linhas indicadas.
 * Se todas já o têm, tira; senão põe, trocando um tipo de lista por outro
 * sem ficar com os dois.
 */
export function toggleLinePrefixInText(text, kind, firstLine, lastLine) {
  const rule = LINE_KINDS[kind];
  const lines = String(text || "").split("\n");
  const targets = lines.slice(firstLine, lastLine + 1);
  const remove = targets.length > 0 && targets.every((line) => rule.test.test(line));

  let number = 1;

  for (let index = firstLine; index <= lastLine && index < lines.length; index += 1) {
    const content = lines[index].replace(rule.strip, "");
    lines[index] = remove ? content : `${rule.prefix(number)}${content}`;
    number += 1;
  }

  return renumberLists(lines, firstLine, lastLine).join("\n");
}

/*
 * Enter numa lista. `before` e `after` são o texto antes e depois do cursor.
 * - Item com texto: parte a linha no cursor e começa um item novo do mesmo
 *   tipo (numa lista numerada, com o número seguinte).
 * - Item vazio: sai da lista, a linha fica normal.
 * Devolve null fora de uma lista: o Enter faz o normal.
 */
export function breakListLine(before, after) {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const head = beforeLines.pop();
  const tail = afterLines.shift();
  const line = head + tail;
  const kind = listKindOf(line);

  if (!kind) return null;

  const prefix = line.match(LIST_PREFIX)[0];
  const current = beforeLines.length;

  if (!line.slice(prefix.length).trim()) {
    const lines = [...beforeLines, "", ...afterLines];
    return result(renumberLists(lines, current, current), current, 0);
  }

  /* Com o cursor antes do prefixo, o item novo (vazio) fica por cima. */
  const cut = Math.max(head.length, prefix.length);
  const next =
    kind === "numbered"
      ? LINE_KINDS.numbered.prefix(parseInt(prefix, 10) + 1)
      : kind === "task"
        ? LINE_KINDS.task.prefix()
        : prefix;

  const lines = renumberLists(
    [
      ...beforeLines,
      line.slice(0, cut),
      next + line.slice(cut).replace(/^ +/, ""),
      ...afterLines,
    ],
    current,
    current + 1,
  );

  return result(lines, current + 1, lines[current + 1].match(LIST_PREFIX)[0].length);
}

/*
 * Backspace logo a seguir ao prefixo de uma lista: tira o prefixo e a linha
 * passa a texto normal, como no Teams. Noutro sítio devolve null e o
 * Backspace apaga como sempre.
 */
export function removeListPrefix(before, after) {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const head = beforeLines.pop();
  const tail = afterLines.shift();

  if (!listKindOf(head + tail) || head !== head.match(LIST_PREFIX)?.[0]) {
    return null;
  }

  const current = beforeLines.length;
  const lines = [...beforeLines, tail, ...afterLines];

  return result(renumberLists(lines, current, current), current, 0);
}
