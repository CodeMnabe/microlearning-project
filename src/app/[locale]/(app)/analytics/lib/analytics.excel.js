/**
 * Construção do livro Excel da dashboard Analytics.
 *
 * Este ficheiro tem duas responsabilidades bem separadas:
 *
 * buildAnalyticsWorkbook(workbook, data, meta)
 *   Função pura. Recebe um livro já criado e preenche-o.
 *   Não importa o ExcelJS, não descarrega nada, não toca no DOM.
 *   É por isso que se consegue testar sem browser.
 *
 * exportAnalyticsExcel({ data, meta })
 *   A parte com efeitos: carrega o ExcelJS, cria o livro, manda
 *   preenchê-lo e entrega o ficheiro ao utilizador.
 *
 * O ficheiro não sabe nada de i18n. Os textos que dependem do idioma
 * chegam já traduzidos dentro de `meta` — assim a lógica das folhas
 * não fica presa ao next-intl e continua testável.
 */

// ==============================
// Aparência
// ==============================

/**
 * Cores do MyDigitalBot.
 *
 * Vêm todas de `src/app/globals.css` e do módulo CSS da própria
 * Analytics, para o ficheiro sair com a mesma identidade do ecrã. O
 * ARGB do ExcelJS é o hexadecimal habitual com dois dígitos de alfa
 * à frente: #30a9e0 escreve-se FF30A9E0.
 *
 *   --brand-1        #30a9e0   cyan, a cor primária
 *   --brand-2        #7cc2ff   azul claro
 *   --ink            #191e3b   navy, a cor estrutural
 *   --ink-secondary  #34d7b6   menta
 *   --success        #2bb673
 *   --danger         #e05252
 */
const BRAND_ARGB = "FF30A9E0";
const NAVY_ARGB = "FF191E3B";

const HEADER_TEXT_ARGB = "FFFFFFFF";

// Os dois tons de texto que o CSS da Analytics mais usa.
const TITLE_TEXT_ARGB = "FF0F172A";
const MUTED_TEXT_ARGB = "FF64748B";

// Banda que assinala o inicio de cada grupo. E o mesmo tom do fundo
// do Painel, para as duas folhas partilharem a mesma familia de cor.
const BAND_ARGB = "FFE4ECF6";

// Cor das reguas de separacao entre celulas na folha de dados.
// Escura de proposito: a folha Resumo e para se ler como uma tabela
// de Excel normal, com as celulas visivelmente separadas.
const RULE_ARGB = "FF262626";


// Vermelho de aviso, usado apenas em valores que exigem atencao.
const ALERT_ARGB = "FFE05252";

// Formatos de número. O Excel mostra estes valores conforme as
// definições regionais de quem abre o ficheiro.
const NUMBER_FORMAT = "#,##0";
const PERCENT_FORMAT = "0.0%";
const RATIO_FORMAT = "#,##0.0";

/**
 * A linha do cabeçalho da tabela.
 *
 * Está em 1, e isso não é detalhe: o congelamento do Excel é sempre a
 * partir do topo, portanto tudo o que estiver acima do cabeçalho fica
 * colado ao ecrã durante todo o scroll. Com o cabeçalho na linha 1,
 * fica uma linha — o mínimo possível.
 *
 * O título e o contexto não desapareceram: vivem na folha Painel, que
 * já os mostra, e no cabeçalho de impressão desta folha, que não gasta
 * altura nenhuma no ecrã.
 */
const HEADER_ROW = 1;

// Os quatro cartões usam o mesmo azul primário da marca.
//
// Cores diferentes por cartão sugeririam categorias diferentes, e não
// há nenhuma: são quatro totais do mesmo tipo. A cor uniforme deixa os
// números serem a única coisa que distingue os cartões.
const CARD_ARGB = ["FF30A9E0", "FF30A9E0", "FF30A9E0", "FF30A9E0"];

/**
 * Cor das barras dentro da célula.
 *
 * É o --brand-2, o azul claro da marca. Tem de ser claro porque o
 * número fica desenhado por cima da barra: com o azul primário, o
 * texto escuro perdia-se contra o fundo.
 */
const BAR_ARGB = "FF7CC2FF";

// Grelha do painel: colunas estreitas que depois se juntam em blocos.
// É este truque que permite desenhar cartões numa folha de cálculo.
const PANEL_COLUMN_WIDTH = 3;
const PANEL_COLUMNS = 24;

/**
 * Temas do painel.
 *
 * O Excel não tem "cor de folha" — a única propriedade de fundo que
 * existe é uma imagem em mosaico, que nem sequer é impressa. Pinta-se
 * célula a célula, como fazem os dashboards a sério.
 *
 * O que faz um fundo parecer morto não é ser claro: é ter pouco
 * contraste com o que está por cima. Um cinzento a 3% do branco não é
 * discreto, é indeciso — os cartões não chegam a separar-se dele.
 *
 * Trocar de tema é trocar uma constante.
 */
const THEMES = {
  light: {
    // Fundo com viés azul, da mesma família das bordas do CSS.
    ground: "FFE4ECF6",
    surface: "FFFFFFFF",
    text: "FF0F172A",
    muted: "FF64748B",
    rule: "FFDBE3EE",
    // A faixa leva o navy estrutural, não o cyan: o cyan é acento e
    // num bloco daquele tamanho passaria a gritar.
    bannerFill: NAVY_ARGB,
    bannerText: "FFFFFFFF",
    bannerMuted: "FF9FD3FF",
    cards: CARD_ARGB,
    // No tema claro a grelha do Excel fica visivel e o fundo nao e
    // pintado: os cartoes destacam-se por serem os unicos blocos
    // brancos, e a folha continua a parecer uma folha de calculo.
    paintGround: false,
    showGridLines: true,
    bar: BAR_ARGB,
  },
  dark: {
    // Os fundos escuros do próprio produto: --bg e --panel.
    ground: "FF0F1420",
    surface: "FF121826",
    text: "FFFFFFFF",
    muted: "FF93A3B5",
    rule: "FF1E2A3F",
    bannerFill: "FF101B33",
    bannerText: "FFFFFFFF",
    bannerMuted: "FF7CC2FF",
    // Sobre fundo escuro o navy desapareceria: entra o azul claro
    // da marca no lugar dele.
    cards: ["FF30A9E0", "FF34D7B6", "FF7CC2FF", "FF2BB673"],
    // No tema escuro o fundo tem de ser pintado, senao a folha fica
    // branca por baixo de blocos escuros.
    paintGround: true,
    showGridLines: false,
    // Sobre fundo escuro o texto dos painéis é claro, por isso a barra
    // pode ser mais carregada sem prejudicar a leitura.
    bar: "FF0E86BA",
  },
};

// Tema usado pelo painel. Trocar para "dark" muda a folha inteira.
const PANEL_THEME = "light";

// ==============================
// Kit de estilo partilhado
// ==============================

/**
 * Prepara o aspeto geral da folha de dados.
 *
 * Deixa a grelha do Excel visível e não fixa painéis: esta folha é para
 * se comportar como uma folha de cálculo normal, onde as pessoas
 * trabalham os números. A vista de apresentação é o Painel.
 */
function applySheetChrome(sheet, { headerRow, lastColumn }) {
  sheet.properties.tabColor = { argb: BRAND_ARGB };

  /**
   * Sem painéis congelados.
   *
   * Esta folha comporta-se como uma folha de cálculo normal: nenhuma
   * linha acompanha o scroll, incluindo o cabeçalho. Quem quiser fixá-lo
   * usa Ver → Fixar Painéis, como faria em qualquer outro ficheiro.
   *
   * Na impressão o cabeçalho continua a repetir-se em todas as páginas,
   * por via do printTitlesRow mais abaixo.
   */
  sheet.views = [{ showGridLines: true }];

  // Para quem imprimir ou guardar como PDF: cabe na largura da pagina
  // e o cabecalho repete-se em cada folha.
  sheet.pageSetup = {
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: `${headerRow}:${headerRow}`,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };

  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: sheet.lastRow.number, column: lastColumn },
  };
}

/**
 * Pinta a linha de cabecalho de uma tabela.
 *
 * As colunas numericas ficam alinhadas a direita, para baterem certo
 * com os valores por baixo.
 */
function styleHeaderRow(row, { numericFrom }) {
  row.height = 22;

  row.eachCell((cell, columnNumber) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT_ARGB } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      // O mesmo navy da faixa do Painel: as duas folhas passam a ler-se
      // como o mesmo documento, e não como dois ficheiros colados.
      fgColor: { argb: NAVY_ARGB },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: columnNumber >= numericFrom ? "right" : "left",
    };
    cell.border = {
      top: { style: "thin", color: { argb: RULE_ARGB } },
      bottom: { style: "thin", color: { argb: RULE_ARGB } },
      left: { style: "thin", color: { argb: RULE_ARGB } },
      right: { style: "thin", color: { argb: RULE_ARGB } },
    };
  });
}

/**
 * Aplica um estilo a todas as células de um intervalo.
 *
 * O ExcelJS guarda o estilo célula a célula, mesmo quando estão unidas.
 * Pintar só a célula do canto deixa o resto do bloco por pintar.
 */
function styleRange(sheet, fromRow, fromCol, toRow, toCol, style) {
  for (let row = fromRow; row <= toRow; row += 1) {
    for (let col = fromCol; col <= toCol; col += 1) {
      Object.assign(sheet.getCell(row, col), style);
    }
  }
}

/**
 * Desenha um cartão de indicador.
 *
 * A anatomia é sempre a mesma: uma barra fina de cor em cima, o rótulo
 * pequeno por baixo, o número grande, e uma linha de contexto no fundo.
 * A cor entra na barra e no número — nunca no fundo do cartão, que numa
 * folha branca pesaria de mais.
 */
function addCard(sheet, { top, left, width, color, label, value, footnote, format, theme }) {
  const right = left + width - 1;

  // Barra de cor no topo.
  sheet.mergeCells(top, left, top, right);
  styleRange(sheet, top, left, top, right, {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: color } },
  });

  // Fundo branco explícito no corpo do cartão.
  //
  // Não é redundante: o painel leva uma passagem final que pinta de
  // cinzento tudo o que ficou sem cor, e é este branco que impede o
  // cartão de ser apanhado por ela. É também o que o faz saltar.
  styleRange(sheet, top + 1, left, top + 3, right, {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: theme.surface } },
  });

  // Rótulo.
  sheet.mergeCells(top + 1, left, top + 1, right);
  const labelCell = sheet.getCell(top + 1, left);
  labelCell.value = label;
  labelCell.font = { size: 8, bold: true, color: { argb: theme.muted } };
  labelCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

  // Número grande.
  sheet.mergeCells(top + 2, left, top + 2, right);
  const valueCell = sheet.getCell(top + 2, left);
  valueCell.value = value;
  valueCell.numFmt = format ?? NUMBER_FORMAT;
  valueCell.font = { size: 20, bold: true, color: { argb: color } };
  valueCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

  // Linha de contexto.
  sheet.mergeCells(top + 3, left, top + 3, right);
  const footCell = sheet.getCell(top + 3, left);
  footCell.value = footnote;
  footCell.font = { size: 8, color: { argb: theme.muted } };
  footCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

  // Contorno fino a fechar o cartão.
  const edge = { style: "thin", color: { argb: theme.rule } };


  for (let col = left; col <= right; col += 1) {
    sheet.getCell(top + 3, col).border = { bottom: edge };
  }

  for (let row = top; row <= top + 3; row += 1) {
    sheet.getCell(row, left).border = {
      ...(sheet.getCell(row, left).border || {}),
      left: edge,
    };
    sheet.getCell(row, right).border = {
      ...(sheet.getCell(row, right).border || {}),
      right: edge,
    };
  }
}

/**
 * Escreve o título de um painel e devolve a linha seguinte.
 */
function addPanelTitle(sheet, { row, left, right, title, theme }) {
  sheet.mergeCells(row, left, row, right);

  const cell = sheet.getCell(row, left);
  cell.value = title;
  cell.font = { size: 9, bold: true, color: { argb: theme.text } };
  cell.alignment = { vertical: "middle" };

  for (let col = left; col <= right; col += 1) {
    sheet.getCell(row, col).border = {
      bottom: { style: "thin", color: { argb: theme.rule } },
    };
  }

  return row + 1;
}

// ==============================
// Folha de painel
// ==============================

/**
 * Desenha a folha "Painel": a vista de apresentação.
 *
 * O ExcelJS não sabe fazer gráficos nativos — verificado, não há
 * `addChart` nenhum. O que existe são barras dentro da célula, escalas
 * de cor e conjuntos de ícones, e é com isso que se constrói aqui a
 * leitura visual. A vantagem sobre uma imagem colada é que estas barras
 * são vivas: mudam quando alguém edita os números.
 */
function addDashboardSheet(workbook, data, meta) {
  const theme = THEMES[meta.theme ?? PANEL_THEME] ?? THEMES.light;

  const sheet = workbook.addWorksheet(meta.labels.dashboardSheet, {
    properties: { tabColor: { argb: theme.cards[0] } },
    views: [{ showGridLines: theme.showGridLines }],
  });

  // Colunas estreitas e todas iguais: é o que permite juntar blocos
  // de larguras diferentes sem partir o alinhamento entre eles.
  sheet.columns = Array.from({ length: PANEL_COLUMNS }, () => ({
    width: PANEL_COLUMN_WIDTH,
  }));

  const {
    users = {},
    messages = {},
    automations = {},
    scheduledBroadcasts = {},
    templates = {},
    trackedLinks = {},
  } = data;

  const labels = meta.labels;

  // ---------- cabeçalho ----------

  /**
   * Faixa de cabeçalho.
   *
   * É o que mais ajuda a folha a não parecer morta: uma âncora forte
   * no topo dá peso à composição toda. Sem ela, um fundo claro com
   * blocos claros não tem onde firmar o olhar.
   */
  styleRange(sheet, 1, 1, 3, PANEL_COLUMNS, {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: theme.bannerFill } },
  });

  sheet.mergeCells(1, 1, 1, PANEL_COLUMNS);
  const title = sheet.getCell(1, 1);
  title.value = labels.title;
  title.font = { size: 18, bold: true, color: { argb: theme.bannerText } };
  title.alignment = { vertical: "middle", indent: 1 };
  sheet.getRow(1).height = 30;

  sheet.mergeCells(2, 1, 2, PANEL_COLUMNS);
  const subtitle = sheet.getCell(2, 1);
  subtitle.value = `${meta.organizationName}  ·  ${meta.periodLabel}  ·  ${meta.exportedAtLabel}`;
  subtitle.font = { size: 9, color: { argb: theme.bannerMuted } };
  subtitle.alignment = { vertical: "middle", indent: 1 };
  sheet.getRow(2).height = 16;
  sheet.getRow(3).height = 6;
  sheet.getRow(4).height = 10;

  // ---------- cartões ----------

  const CARD_TOP = 5;

  sheet.getRow(CARD_TOP).height = 4;
  sheet.getRow(CARD_TOP + 1).height = 14;
  sheet.getRow(CARD_TOP + 2).height = 30;
  sheet.getRow(CARD_TOP + 3).height = 14;
  sheet.getRow(CARD_TOP + 4).height = 10;

  const cards = [
    {
      label: labels.groups.users,
      value: users.total ?? 0,
      footnote: `${users.withAssistant ?? 0} ${labels.metrics.withAssistant.toLowerCase()}`,
    },
    {
      label: labels.groups.messages,
      value: messages.total ?? 0,
      footnote: `${messages.read ?? 0} ${labels.metrics.read.toLowerCase()}`,
    },
    {
      label: labels.groups.automations,
      value: automations.runsTotal ?? 0,
      footnote: `${automations.runsFailed ?? 0} ${labels.metrics.runsFailed.toLowerCase()}`,
    },
    {
      label: labels.groups.trackedLinks,
      value: trackedLinks.totalClicks ?? 0,
      footnote: `${trackedLinks.totalLinks ?? 0} ${labels.metrics.linksTotal.toLowerCase()}`,
    },
  ];

  cards.forEach((card, index) => {
    addCard(sheet, {
      top: CARD_TOP,
      left: 1 + index * 6,
      width: 5,
      color: theme.cards[index],
      theme,
      ...card,
    });
  });

  // ---------- painéis com barras ----------

  /**
   * Escreve um painel de barras.
   *
   * Cada linha é um rótulo e um valor; a barra é formatação condicional
   * aplicada ao intervalo inteiro dos valores, para que se escalem umas
   * às outras — que é o que faz aquilo ler-se como um gráfico.
   */
  function addBarPanel({ row, left, right, title: panelTitle, rows, color }) {
    // O painel é um bloco branco sobre o fundo cinzento: título mais
    // uma linha por métrica.
    styleRange(sheet, row, left, row + rows.length, right, {
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: theme.surface } },
    });

    let current = addPanelTitle(sheet, {
      row,
      left,
      right,
      title: panelTitle,
      theme,
    });

    const firstValueRow = current;
    const labelRight = left + 5;
    const valueLeft = labelRight + 1;

    rows.forEach((item) => {
      sheet.getRow(current).height = 16;

      sheet.mergeCells(current, left, current, labelRight);
      const labelCell = sheet.getCell(current, left);
      labelCell.value = item.label;
      labelCell.font = { size: 9, color: { argb: theme.text } };
      labelCell.alignment = { vertical: "middle", indent: 1 };

      sheet.mergeCells(current, valueLeft, current, right);
      const valueCell = sheet.getCell(current, valueLeft);
      valueCell.value = item.value ?? 0;
      valueCell.numFmt = NUMBER_FORMAT;
      valueCell.font = { size: 9, bold: true, color: { argb: theme.text } };
      valueCell.alignment = { horizontal: "right", vertical: "middle" };

      current += 1;
    });

    const columnLetter = sheet.getColumn(valueLeft).letter;

    sheet.addConditionalFormatting({
      ref: `${columnLetter}${firstValueRow}:${columnLetter}${current - 1}`,
      rules: [
        {
          type: "dataBar",
          priority: 10,
          gradient: false,
          // A barra arranca sempre do zero. Deixar o mínimo flutuar
          // faria a barra mais curta parecer vazia e mentiria na comparação.
          cfvo: [{ type: "num", value: 0 }, { type: "max" }],
          color: { argb: color },
        },
      ],
    });

    return current + 1;
  }

  const PANEL_TOP = CARD_TOP + 5;

  const leftEnd = addBarPanel({
    row: PANEL_TOP,
    left: 1,
    right: 11,
    title: labels.panels.messages,
    color: theme.bar,
    rows: [
      { label: labels.metrics.whatsapp, value: messages.whatsapp },
      { label: labels.metrics.teams, value: messages.teams },
      { label: labels.metrics.delivered, value: messages.delivered },
      { label: labels.metrics.read, value: messages.read },
      { label: labels.metrics.failed, value: messages.failed },
    ],
  });

  const rightEnd = addBarPanel({
    row: PANEL_TOP,
    left: 13,
    right: 23,
    title: labels.panels.operations,
    color: theme.bar,
    rows: [
      { label: labels.metrics.runsProcessed, value: automations.runsProcessed },
      { label: labels.metrics.runsFailed, value: automations.runsFailed },
      { label: labels.metrics.completed, value: scheduledBroadcasts.completed },
      { label: labels.metrics.queued, value: scheduledBroadcasts.queued },
      { label: labels.metrics.recipients, value: scheduledBroadcasts.recipientCount },
    ],
  });

  addBarPanel({
    row: Math.max(leftEnd, rightEnd) + 1,
    left: 1,
    right: 11,
    title: labels.panels.templates,
    color: theme.bar,
    rows: [
      { label: labels.metrics.active, value: templates.active },
      { label: labels.metrics.pending, value: templates.pending },
      { label: labels.metrics.rejected, value: templates.rejected },
    ],
  });

  /**
   * Pinta o fundo, por último e só onde ainda não há cor.
   *
   * Só corre nos temas que precisam dele. No tema claro a folha fica
   * com a grelha do Excel à vista e sem fundo pintado — os cartões e
   * os painéis destacam-se por serem os únicos blocos brancos, que é
   * o que também esconde a grelha por baixo deles.
   *
   * A ordem importa: se pintássemos primeiro, os cartões ficavam por
   * baixo. O getCell de uma célula unida devolve a célula-mestra, por
   * isso os blocos já pintados não são apanhados duas vezes.
   */
  if (theme.paintGround) {
    const groundLastRow = sheet.lastRow.number + 3;

    for (let row = 1; row <= groundLastRow; row += 1) {
      for (let column = 1; column <= PANEL_COLUMNS; column += 1) {
        const cell = sheet.getCell(row, column);

        if (!cell.fill) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: theme.ground },
          };
        }
      }
    }
  }

  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };

  return sheet;
}

// ==============================
// Folha de resumo
// ==============================

/**
 * Escreve a folha "Resumo": os indicadores que a dashboard mostra,
 * um por linha, agrupados como na página.
 */
function addSummarySheet(workbook, data, meta) {
  const sheet = workbook.addWorksheet(meta.labels.summarySheet);

  /**
   * Larguras das colunas.
   *
   * Reparar que não damos `header` aqui. Se déssemos, o ExcelJS
   * escrevia já uma linha de cabeçalho na linha 1 — e nós queremos
   * um bloco de título por cima dela.
   */
  /**
   * Larguras das colunas.
   *
   * As duas numéricas são mais largas do que o conteúdo precisa: a seta
   * do filtro automático desenha-se por cima do texto do cabeçalho, e
   * sem folga escondia as palavras "Valor" e "Taxa".
   *
   * Não damos `header` aqui. Se déssemos, o ExcelJS escrevia já uma
   * linha de cabeçalho — nós escrevemos a nossa mais abaixo.
   */
  sheet.columns = [
    { key: "group", width: 24 },
    { key: "metric", width: 36 },
    { key: "value", width: 17 },
    { key: "rate", width: 15 },
  ];

  // ---------- bloco de título ----------

  /**
   * O contexto vai para o cabeçalho de impressão.
   *
   * É o sítio certo para ele: aparece em todas as páginas impressas e
   * não gasta uma única linha do ecrã — que é exatamente o problema
   * que tínhamos ao pô-lo em células.
   */
  sheet.headerFooter = {
    oddHeader: `&L&"Calibri"&9&K64748B${meta.labels.title}  ·  ${meta.organizationName}  ·  ${meta.periodLabel}  ·  ${meta.exportedAtLabel}`,
    oddFooter: '&R&"Calibri"&9&K64748B&P / &N',
  };

  // ---------- cabeçalho da tabela ----------

  const headerRow = sheet.getRow(HEADER_ROW);

  headerRow.values = [
    meta.labels.columnGroup,
    meta.labels.columnMetric,
    meta.labels.columnValue,
    meta.labels.columnRate,
  ];

  styleHeaderRow(headerRow, { numericFrom: 3 });

  // ---------- linhas ----------

  /**
   * Guarda em que linha ficou cada métrica.
   *
   * É isto que permite escrever fórmulas mais abaixo: para dizer
   * "lidas a dividir por total" precisamos de saber que o total
   * ficou, por exemplo, na linha 19.
   */
  const rowOf = {};

  // O nome do grupo só é escrito na primeira linha de cada grupo.
  // Repeti-lo em todas tornaria a folha ruidosa de ler.
  let currentGroup = null;

  // Células que devem ficar em vermelho quando o valor for maior que zero.
  const warningCells = [];

  function addMetric({
    group,
    label,
    value,
    key,
    format = NUMBER_FORMAT,
    isWarning = false,
  }) {
    const isFirstOfGroup = group !== currentGroup;
    currentGroup = group;

    const row = sheet.addRow([
      isFirstOfGroup ? group : null,
      label,
      value ?? 0,
    ]);

    row.height = 17;

    /**
     * A primeira linha de cada grupo leva uma banda muito clara e uma
     * régua por cima.
     *
     * Preferimos isto a listras alternadas: as listras são decoração e
     * não dizem nada, esta banda diz "começa aqui um grupo novo".
     */
    if (isFirstOfGroup) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: BAND_ARGB },
        };
        cell.border = {
          top: { style: "thin", color: { argb: RULE_ARGB } },
        };
      });

      row.getCell(1).font = { bold: true, color: { argb: TITLE_TEXT_ARGB } };
    }

    // Linhas de separacao em todas as celulas da tabela, como numa
    // folha de Excel com bordas.
    const cellEdge = { style: "thin", color: { argb: RULE_ARGB } };

    for (let column = 1; column <= 4; column += 1) {
      const cell = row.getCell(column);

      cell.border = {
        ...(cell.border || {}),
        top: cell.border?.top ?? cellEdge,
        bottom: cellEdge,
        left: cellEdge,
        right: cellEdge,
      };
    }

    row.getCell(2).alignment = { horizontal: "left" };
    row.getCell(3).numFmt = format;
    row.getCell(3).alignment = { horizontal: "right" };

    if (key) {
      rowOf[key] = row.number;
    }

    // Guardamos as métricas de falha para lhes aplicar formatação
    // condicional no fim, quando já sabemos em que linhas ficaram.
    if (isWarning) {
      warningCells.push(`C${row.number}`);
    }

    return row;
  }

  /**
   * Escreve uma taxa como FÓRMULA, não como número fechado.
   *
   * É esta a diferença entre um relatório que se lê e uma folha em
   * que a pessoa pode mexer: se ela corrigir o total, a taxa acompanha.
   *
   * O IF(...=0; 0; ...) evita que apareça #DIV/0! quando não há dados.
   *
   * Damos também o `result` já calculado. Sem ele, alguns visualizadores
   * (o Google Sheets, os painéis de pré-visualização) mostram a célula
   * vazia até recalcularem o livro.
   */
  function addRate({ atKey, partKey, totalKey, format = PERCENT_FORMAT }) {
    const targetRow = rowOf[atKey];
    const partRow = rowOf[partKey];
    const totalRow = rowOf[totalKey];

    if (!targetRow || !partRow || !totalRow) return;

    const part = Number(sheet.getCell(`C${partRow}`).value) || 0;
    const total = Number(sheet.getCell(`C${totalRow}`).value) || 0;

    const cell = sheet.getCell(`D${targetRow}`);

    cell.value = {
      formula: `IF(C${totalRow}=0,0,C${partRow}/C${totalRow})`,
      result: total === 0 ? 0 : part / total,
    };

    cell.numFmt = format;
  }

  const {
    users = {},
    assistants = {},
    templates = {},
    messages = {},
    automations = {},
    scheduledBroadcasts = {},
    trackedLinks = {},
    pendingOutreach = {},
  } = data;

  const groups = meta.labels.groups;
  const metrics = meta.labels.metrics;

  // Utilizadores
  addMetric({ group: groups.users, label: metrics.total, value: users.total, key: "users.total" });
  addMetric({ group: groups.users, label: metrics.withAssistant, value: users.withAssistant, key: "users.withAssistant" });
  addMetric({ group: groups.users, label: metrics.withoutAssistant, value: users.withoutAssistant });
  addMetric({ group: groups.users, label: metrics.withEmail, value: users.withEmail });
  addMetric({ group: groups.users, label: metrics.withPhone, value: users.withPhone });
  addMetric({ group: groups.users, label: metrics.withTeams, value: users.withTeams });
  addMetric({ group: groups.users, label: metrics.withWhatsapp, value: users.withWhatsapp });

  addRate({ atKey: "users.withAssistant", partKey: "users.withAssistant", totalKey: "users.total" });

  // Assistentes
  addMetric({ group: groups.assistants, label: metrics.total, value: assistants.total });
  addMetric({ group: groups.assistants, label: metrics.withoutOpenAiId, value: assistants.withoutOpenAiId, isWarning: true });

  // Mensagens
  addMetric({ group: groups.messages, label: metrics.total, value: messages.total, key: "messages.total" });
  addMetric({ group: groups.messages, label: metrics.whatsapp, value: messages.whatsapp });
  addMetric({ group: groups.messages, label: metrics.teams, value: messages.teams });
  addMetric({ group: groups.messages, label: metrics.fromUser, value: messages.userMessages });
  addMetric({ group: groups.messages, label: metrics.fromAssistant, value: messages.assistantMessages });
  addMetric({ group: groups.messages, label: metrics.delivered, value: messages.delivered, key: "messages.delivered" });
  addMetric({ group: groups.messages, label: metrics.read, value: messages.read, key: "messages.read" });
  addMetric({ group: groups.messages, label: metrics.failed, value: messages.failed, key: "messages.failed", isWarning: true });

  addRate({ atKey: "messages.delivered", partKey: "messages.delivered", totalKey: "messages.total" });
  addRate({ atKey: "messages.read", partKey: "messages.read", totalKey: "messages.total" });
  addRate({ atKey: "messages.failed", partKey: "messages.failed", totalKey: "messages.total" });

  // Automações
  addMetric({ group: groups.automations, label: metrics.rulesTotal, value: automations.rulesTotal });
  addMetric({ group: groups.automations, label: metrics.rulesActive, value: automations.rulesActive });
  addMetric({ group: groups.automations, label: metrics.rulesPaused, value: automations.rulesPaused });
  addMetric({ group: groups.automations, label: metrics.runsTotal, value: automations.runsTotal, key: "automations.runsTotal" });
  addMetric({ group: groups.automations, label: metrics.runsProcessed, value: automations.runsProcessed, key: "automations.runsProcessed" });
  addMetric({ group: groups.automations, label: metrics.runsFailed, value: automations.runsFailed, key: "automations.runsFailed", isWarning: true });

  addRate({ atKey: "automations.runsProcessed", partKey: "automations.runsProcessed", totalKey: "automations.runsTotal" });
  addRate({ atKey: "automations.runsFailed", partKey: "automations.runsFailed", totalKey: "automations.runsTotal" });

  // Mensagens agendadas
  addMetric({ group: groups.scheduled, label: metrics.total, value: scheduledBroadcasts.total, key: "scheduled.total" });
  addMetric({ group: groups.scheduled, label: metrics.queued, value: scheduledBroadcasts.queued });
  addMetric({ group: groups.scheduled, label: metrics.completed, value: scheduledBroadcasts.completed, key: "scheduled.completed" });
  addMetric({ group: groups.scheduled, label: metrics.failed, value: scheduledBroadcasts.failed, isWarning: true });
  addMetric({ group: groups.scheduled, label: metrics.recipients, value: scheduledBroadcasts.recipientCount });

  addRate({ atKey: "scheduled.completed", partKey: "scheduled.completed", totalKey: "scheduled.total" });

  // Templates
  addMetric({ group: groups.templates, label: metrics.total, value: templates.total });
  addMetric({ group: groups.templates, label: metrics.active, value: templates.active });
  addMetric({ group: groups.templates, label: metrics.pending, value: templates.pending });
  addMetric({ group: groups.templates, label: metrics.rejected, value: templates.rejected, isWarning: true });

  // Links rastreados
  addMetric({ group: groups.trackedLinks, label: metrics.linksTotal, value: trackedLinks.totalLinks, key: "links.total" });
  addMetric({ group: groups.trackedLinks, label: metrics.clicksTotal, value: trackedLinks.totalClicks, key: "links.clicks" });

  // Cliques por link não é uma percentagem: é uma razão.
  addRate({
    atKey: "links.clicks",
    partKey: "links.clicks",
    totalKey: "links.total",
    format: RATIO_FORMAT,
  });

  // Outreach pendente
  addMetric({ group: groups.pendingOutreach, label: metrics.total, value: pendingOutreach.total });
  addMetric({ group: groups.pendingOutreach, label: metrics.active, value: pendingOutreach.active });

  // ---------- acabamentos ----------

  /**
   * Formatação condicional nas métricas de falha.
   *
   * Podíamos ter pintado a célula de vermelho ao escrevê-la, mas seria
   * uma cor fixa: se a pessoa corrigir o valor para zero na folha, o
   * vermelho ficava lá a mentir. Assim a regra vive no ficheiro e
   * continua verdadeira depois de editada.
   */
  if (warningCells.length > 0) {
    sheet.addConditionalFormatting({
      ref: warningCells.join(" "),
      rules: [
        {
          type: "cellIs",
          operator: "greaterThan",
          formulae: [0],
          priority: 1,
          style: {
            font: { color: { argb: ALERT_ARGB }, bold: true },
          },
        },
      ],
    });
  }

  applySheetChrome(sheet, { headerRow: HEADER_ROW, lastColumn: 4 });

  return sheet;
}

// ==============================
// Livro completo
// ==============================

/**
 * Preenche um livro ExcelJS com os dados da dashboard.
 *
 * Recebe o livro já criado em vez de o criar aqui: assim esta função
 * não precisa de importar o ExcelJS e pode ser testada passando-lhe
 * um livro criado pelo próprio teste.
 */
export function buildAnalyticsWorkbook(workbook, data, meta) {
  workbook.creator = "MyDigitalBot";
  workbook.created = meta.exportedAt ?? new Date();

  // Manda o Excel recalcular as fórmulas ao abrir o ficheiro.
  // As taxas já vão com o resultado gravado, mas assim ficam certas
  // mesmo que alguém edite os valores e volte a abrir.
  workbook.calcProperties.fullCalcOnLoad = true;

  // O Resumo vem primeiro: é a folha de dados, e é com ela que as
  // pessoas trabalham. O Painel fica a seguir, como vista de
  // apresentação.
  addSummarySheet(workbook, data, meta);
  addDashboardSheet(workbook, data, meta);

  return workbook;
}

// ==============================
// Descarregar
// ==============================

/**
 * Gera e entrega o ficheiro ao utilizador.
 *
 * O ExcelJS só é carregado aqui, e de forma dinâmica: o build para
 * navegador tem cerca de 900 KB e não tem nada que fazer no bundle
 * inicial da página.
 */
export async function exportAnalyticsExcel({ data, meta }) {
  const ExcelJS = await import("exceljs");

  const workbook = new ExcelJS.Workbook();

  buildAnalyticsWorkbook(workbook, data, meta);

  const buffer = await workbook.xlsx.writeBuffer();

  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = meta.fileName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Sem isto o blob fica em memória até a página ser recarregada.
  URL.revokeObjectURL(url);
}
