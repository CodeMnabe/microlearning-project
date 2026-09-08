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

// Verde DIGIK, no formato ARGB que o ExcelJS usa: alfa + RGB.
const BRAND_ARGB = "FF1D6B58";

const HEADER_TEXT_ARGB = "FFFFFFFF";
const TITLE_TEXT_ARGB = "FF131F2B";
const MUTED_TEXT_ARGB = "FF56687C";

// Formatos de número. O Excel mostra estes valores conforme as
// definições regionais de quem abre o ficheiro.
const NUMBER_FORMAT = "#,##0";
const PERCENT_FORMAT = "0.0%";
const RATIO_FORMAT = "#,##0.0";

// A linha onde começa a tabela. Acima dela fica o bloco de título.
const HEADER_ROW = 6;

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
  sheet.columns = [
    { key: "group", width: 24 },
    { key: "metric", width: 36 },
    { key: "value", width: 14 },
    { key: "rate", width: 12 },
  ];

  // ---------- bloco de título ----------

  sheet.mergeCells("A1:D1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = meta.labels.title;
  titleCell.font = { bold: true, size: 16, color: { argb: TITLE_TEXT_ARGB } };

  const subtitleLines = [
    `${meta.labels.organization}: ${meta.organizationName}`,
    `${meta.labels.period}: ${meta.periodLabel}`,
    `${meta.labels.exportedAt}: ${meta.exportedAtLabel}`,
  ];

  subtitleLines.forEach((text, index) => {
    const cell = sheet.getCell(`A${index + 2}`);
    cell.value = text;
    cell.font = { size: 10, color: { argb: MUTED_TEXT_ARGB } };
  });

  // Linha 5 fica vazia de propósito, a separar o título da tabela.

  // ---------- cabeçalho da tabela ----------

  const headerRow = sheet.getRow(HEADER_ROW);

  headerRow.values = [
    meta.labels.columnGroup,
    meta.labels.columnMetric,
    meta.labels.columnValue,
    meta.labels.columnRate,
  ];

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT_ARGB } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND_ARGB },
    };
    cell.alignment = { vertical: "middle" };
  });

  headerRow.height = 20;

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

  function addMetric({ group, label, value, key, format = NUMBER_FORMAT }) {
    const isFirstOfGroup = group !== currentGroup;
    currentGroup = group;

    const row = sheet.addRow([
      isFirstOfGroup ? group : null,
      label,
      value ?? 0,
    ]);

    if (isFirstOfGroup) {
      row.getCell(1).font = { bold: true };
    }

    row.getCell(3).numFmt = format;

    if (key) {
      rowOf[key] = row.number;
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
  addMetric({ group: groups.assistants, label: metrics.withoutOpenAiId, value: assistants.withoutOpenAiId });

  // Mensagens
  addMetric({ group: groups.messages, label: metrics.total, value: messages.total, key: "messages.total" });
  addMetric({ group: groups.messages, label: metrics.whatsapp, value: messages.whatsapp });
  addMetric({ group: groups.messages, label: metrics.teams, value: messages.teams });
  addMetric({ group: groups.messages, label: metrics.fromUser, value: messages.userMessages });
  addMetric({ group: groups.messages, label: metrics.fromAssistant, value: messages.assistantMessages });
  addMetric({ group: groups.messages, label: metrics.delivered, value: messages.delivered, key: "messages.delivered" });
  addMetric({ group: groups.messages, label: metrics.read, value: messages.read, key: "messages.read" });
  addMetric({ group: groups.messages, label: metrics.failed, value: messages.failed, key: "messages.failed" });

  addRate({ atKey: "messages.delivered", partKey: "messages.delivered", totalKey: "messages.total" });
  addRate({ atKey: "messages.read", partKey: "messages.read", totalKey: "messages.total" });
  addRate({ atKey: "messages.failed", partKey: "messages.failed", totalKey: "messages.total" });

  // Automações
  addMetric({ group: groups.automations, label: metrics.rulesTotal, value: automations.rulesTotal });
  addMetric({ group: groups.automations, label: metrics.rulesActive, value: automations.rulesActive });
  addMetric({ group: groups.automations, label: metrics.rulesPaused, value: automations.rulesPaused });
  addMetric({ group: groups.automations, label: metrics.runsTotal, value: automations.runsTotal, key: "automations.runsTotal" });
  addMetric({ group: groups.automations, label: metrics.runsProcessed, value: automations.runsProcessed, key: "automations.runsProcessed" });
  addMetric({ group: groups.automations, label: metrics.runsFailed, value: automations.runsFailed, key: "automations.runsFailed" });

  addRate({ atKey: "automations.runsProcessed", partKey: "automations.runsProcessed", totalKey: "automations.runsTotal" });
  addRate({ atKey: "automations.runsFailed", partKey: "automations.runsFailed", totalKey: "automations.runsTotal" });

  // Mensagens agendadas
  addMetric({ group: groups.scheduled, label: metrics.total, value: scheduledBroadcasts.total, key: "scheduled.total" });
  addMetric({ group: groups.scheduled, label: metrics.queued, value: scheduledBroadcasts.queued });
  addMetric({ group: groups.scheduled, label: metrics.completed, value: scheduledBroadcasts.completed, key: "scheduled.completed" });
  addMetric({ group: groups.scheduled, label: metrics.failed, value: scheduledBroadcasts.failed });
  addMetric({ group: groups.scheduled, label: metrics.recipients, value: scheduledBroadcasts.recipientCount });

  addRate({ atKey: "scheduled.completed", partKey: "scheduled.completed", totalKey: "scheduled.total" });

  // Templates
  addMetric({ group: groups.templates, label: metrics.total, value: templates.total });
  addMetric({ group: groups.templates, label: metrics.active, value: templates.active });
  addMetric({ group: groups.templates, label: metrics.pending, value: templates.pending });
  addMetric({ group: groups.templates, label: metrics.rejected, value: templates.rejected });

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

  const lastRow = sheet.lastRow.number;

  // Cabeçalho sempre visível ao rolar.
  sheet.views = [{ state: "frozen", ySplit: HEADER_ROW }];

  // Filtros nas quatro colunas da tabela.
  sheet.autoFilter = {
    from: `A${HEADER_ROW}`,
    to: `D${lastRow}`,
  };

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

  addSummarySheet(workbook, data, meta);

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
