// @vitest-environment node

/**
 * Testes do construtor do livro Excel.
 *
 * Não precisam de browser nem de download: o buildAnalyticsWorkbook é
 * uma função pura que recebe um livro e o preenche. O teste cria um
 * livro ExcelJS verdadeiro, manda preenchê-lo, e lê as células.
 */

import { describe, it, expect, beforeEach } from "vitest";
import ExcelJS from "exceljs";

import { buildAnalyticsWorkbook } from "@/app/[locale]/(app)/analytics/lib/analytics.excel";

const META = {
  organizationName: "DIGIK",
  periodLabel: "Últimos 30 dias",
  exportedAt: new Date("2026-09-08T10:00:00Z"),
  exportedAtLabel: "08/09/2026",
  fileName: "analytics.xlsx",
  labels: {
    title: "Analytics",
    summarySheet: "Resumo",
    dashboardSheet: "Painel",
    panels: {
      messages: "MENSAGENS",
      operations: "OPERAÇÃO",
      templates: "TEMPLATES",
    },
    organization: "Organização",
    period: "Período",
    exportedAt: "Exportado em",
    columnGroup: "Grupo",
    columnMetric: "Métrica",
    columnValue: "Valor",
    columnRate: "Taxa",
    groups: {
      users: "Utilizadores",
      assistants: "Assistentes",
      messages: "Mensagens",
      automations: "Automações",
      scheduled: "Mensagens agendadas",
      templates: "Templates",
      trackedLinks: "Links rastreados",
      pendingOutreach: "Outreach pendente",
    },
    metrics: {
      total: "Total",
      withAssistant: "Com assistente",
      withoutAssistant: "Sem assistente",
      withEmail: "Com email",
      withPhone: "Com telefone",
      withTeams: "Com Teams",
      withWhatsapp: "Com WhatsApp",
      withoutOpenAiId: "Sem OpenAI ID",
      whatsapp: "WhatsApp",
      teams: "Teams",
      fromUser: "Do utilizador",
      fromAssistant: "Do assistente",
      delivered: "Entregues",
      read: "Lidas",
      failed: "Falhadas",
      rulesTotal: "Regras",
      rulesActive: "Regras ativas",
      rulesPaused: "Regras pausadas",
      runsTotal: "Execuções",
      runsProcessed: "Processadas",
      runsFailed: "Falhadas",
      queued: "Em fila",
      completed: "Concluídas",
      recipients: "Destinatários",
      active: "Ativos",
      pending: "Pendentes",
      rejected: "Rejeitados",
      linksTotal: "Links",
      clicksTotal: "Cliques",
    },
  },
};

const DATA = {
  users: {
    total: 54,
    withAssistant: 40,
    withoutAssistant: 14,
    withEmail: 50,
    withPhone: 48,
    withTeams: 12,
    withWhatsapp: 48,
  },
  assistants: { total: 3, withoutOpenAiId: 1 },
  templates: { total: 9, active: 6, pending: 2, rejected: 1 },
  messages: {
    total: 825,
    whatsapp: 700,
    teams: 125,
    userMessages: 400,
    assistantMessages: 425,
    delivered: 800,
    read: 618,
    failed: 25,
  },
  automations: {
    rulesTotal: 6,
    rulesActive: 4,
    rulesPaused: 2,
    runsTotal: 41,
    runsProcessed: 38,
    runsFailed: 3,
  },
  scheduledBroadcasts: {
    total: 71,
    queued: 5,
    completed: 63,
    failed: 3,
    recipientCount: 1240,
  },
  trackedLinks: { totalLinks: 12, totalClicks: 30 },
  pendingOutreach: { total: 141, active: 20 },
};

let workbook;
let sheet;

beforeEach(() => {
  workbook = new ExcelJS.Workbook();
  buildAnalyticsWorkbook(workbook, DATA, META);
  sheet = workbook.getWorksheet("Resumo");
});

/** Devolve a linha em que está uma métrica, procurando pela coluna B. */
function rowOfMetric(group, label) {
  let found = null;
  let currentGroup = null;

  sheet.eachRow((row, number) => {
    if (number <= 1) return;

    const groupCell = row.getCell(1).value;
    if (groupCell) currentGroup = groupCell;

    if (currentGroup === group && row.getCell(2).value === label) {
      found = number;
    }
  });

  return found;
}

describe("folha de resumo", () => {
  it("cria a folha com o nome pedido", () => {
    expect(sheet).toBeDefined();
  });

  it("não fixa linha nenhuma ao topo", () => {
    // Comporta-se como uma folha de cálculo normal: nada acompanha o
    // scroll. Quem quiser o cabeçalho fixo usa Ver → Fixar Painéis.
    expect(sheet.getCell("A1").value).toBe("Grupo");
    expect(sheet.views[0].state).toBeUndefined();
    expect(sheet.views[0].ySplit).toBeUndefined();
  });

  it("põe o contexto no cabeçalho de impressão, não em células", () => {
    // Aparece em todas as páginas impressas e não gasta altura no ecrã.
    const { oddHeader } = sheet.headerFooter;

    expect(oddHeader).toContain("Analytics");
    expect(oddHeader).toContain("DIGIK");
    expect(oddHeader).toContain("Últimos 30 dias");
  });

  it("põe o cabeçalho na linha 1, no navy do Painel", () => {
    const header = sheet.getRow(1);

    expect(header.getCell(1).value).toBe("Grupo");
    expect(header.getCell(4).value).toBe("Taxa");
    expect(header.getCell(1).font.bold).toBe(true);
    // O mesmo navy da faixa do Painel: as duas folhas leem-se como
    // o mesmo documento.
    expect(header.getCell(1).fill.fgColor.argb).toBe("FF191E3B");
  });

  it("escreve o nome do grupo só na primeira linha de cada grupo", () => {
    const first = rowOfMetric("Utilizadores", "Total");
    const second = rowOfMetric("Utilizadores", "Com assistente");

    expect(sheet.getRow(first).getCell(1).value).toBe("Utilizadores");
    expect(sheet.getRow(second).getCell(1).value).toBeNull();
  });

  it("grava os valores como números, não como texto", () => {
    const row = sheet.getRow(rowOfMetric("Mensagens", "Total"));

    expect(row.getCell(3).value).toBe(825);
    expect(typeof row.getCell(3).value).toBe("number");
    expect(row.getCell(3).numFmt).toBe("#,##0");
  });

  it("grava as taxas como fórmula, não como número fechado", () => {
    const totalRow = rowOfMetric("Mensagens", "Total");
    const readRow = rowOfMetric("Mensagens", "Lidas");

    const cell = sheet.getCell(`D${readRow}`);

    expect(cell.value.formula).toBe(
      `IF(C${totalRow}=0,0,C${readRow}/C${totalRow})`,
    );
    expect(cell.numFmt).toBe("0.0%");
  });

  it("guarda o resultado calculado ao lado da fórmula", () => {
    const readRow = rowOfMetric("Mensagens", "Lidas");
    const cell = sheet.getCell(`D${readRow}`);

    // 618 / 825 = 0.749...
    expect(cell.value.result).toBeCloseTo(618 / 825, 6);
  });

  it("usa razão e não percentagem para cliques por link", () => {
    const clicksRow = rowOfMetric("Links rastreados", "Cliques");
    const cell = sheet.getCell(`D${clicksRow}`);

    expect(cell.numFmt).toBe("#,##0.0");
    expect(cell.value.result).toBeCloseTo(30 / 12, 6);
  });

  it("não deixa o Excel mostrar #DIV/0! quando não há dados", () => {
    const emptyWorkbook = new ExcelJS.Workbook();

    buildAnalyticsWorkbook(
      emptyWorkbook,
      {
        ...DATA,
        messages: { total: 0, read: 0, delivered: 0, failed: 0 },
      },
      META,
    );

    const emptySheet = emptyWorkbook.getWorksheet("Resumo");

    let readCell = null;
    emptySheet.eachRow((row) => {
      if (row.getCell(2).value === "Lidas" && row.getCell(4).value) {
        readCell = row.getCell(4);
      }
    });

    // A proteção contra #DIV/0! é a fórmula em si, não o resultado
    // gravado. Nota: o ficheiro gerado leva mesmo <v>0</v>, mas o
    // modelo em memória do ExcelJS descarta um `result` falsy — por
    // isso afirmamos aqui a fórmula, que é o que protege.
    expect(readCell.value.formula).toContain("IF(");
    expect(readCell.value.formula).toContain("=0,0,");
  });

  it("manda recalcular ao abrir", () => {
    expect(workbook.calcProperties.fullCalcOnLoad).toBe(true);
  });

  it("liga os filtros a toda a tabela", () => {
    expect(sheet.autoFilter.from).toEqual({ row: 1, column: 1 });
    expect(sheet.autoFilter.to.column).toBe(4);
    expect(sheet.autoFilter.to.row).toBeGreaterThan(1);
  });

  it("mostra a grelha do Excel", () => {
    // Esta é a folha de dados: comporta-se como uma folha de cálculo
    // normal, onde as pessoas trabalham. É o Painel que é a vista de
    // apresentação.
    expect(sheet.views[0].showGridLines).toBe(true);
  });

  it("separa as células com linhas escuras", () => {
    const row = sheet.getRow(rowOfMetric("Mensagens", "Total"));

    expect(row.getCell(2).border.bottom).toEqual({
      style: "thin",
      color: { argb: "FF262626" },
    });
  });

  it("pinta o separador com a cor da marca", () => {
    expect(sheet.properties.tabColor).toEqual({ argb: "FF30A9E0" });
  });

  it("assinala o início de cada grupo com banda e régua", () => {
    const first = sheet.getRow(rowOfMetric("Mensagens", "Total"));
    const second = sheet.getRow(rowOfMetric("Mensagens", "WhatsApp"));

    expect(first.getCell(1).fill.fgColor.argb).toBe("FFE4ECF6");
    expect(first.getCell(1).border.top.style).toBe("thin");

    // As linhas seguintes do grupo ficam limpas — a banda marca o
    // início, não decora o grupo todo.
    expect(second.getCell(1).fill).toBeUndefined();
  });

  it("alinha os valores à direita e os rótulos à esquerda", () => {
    const row = sheet.getRow(rowOfMetric("Mensagens", "Total"));

    expect(row.getCell(2).alignment.horizontal).toBe("left");
    expect(row.getCell(3).alignment.horizontal).toBe("right");
  });

  it("marca as métricas de falha com regra condicional, não com cor fixa", () => {
    const rules = sheet.conditionalFormattings;

    expect(rules).toHaveLength(1);

    const [formatting] = rules;
    const failedRow = rowOfMetric("Mensagens", "Falhadas");

    // A regra cobre a célula das mensagens falhadas...
    expect(formatting.ref).toContain(`C${failedRow}`);

    // ...e só pinta quando o valor é maior que zero, de modo que
    // continua verdadeira se alguém corrigir o número na folha.
    expect(formatting.rules[0]).toMatchObject({
      type: "cellIs",
      operator: "greaterThan",
      formulae: [0],
    });
    expect(formatting.rules[0].style.font.color.argb).toBe("FFE05252");

    // O valor em si NÃO leva cor fixa gravada.
    expect(sheet.getCell(`C${failedRow}`).font).toBeUndefined();
  });

  it("prepara a folha para impressão", () => {
    expect(sheet.pageSetup.fitToWidth).toBe(1);
    expect(sheet.pageSetup.printTitlesRow).toBe("1:1");
  });

  it("dá largura a todas as colunas", () => {
    sheet.columns.forEach((column) => {
      expect(column.width).toBeGreaterThan(0);
    });
  });

  it("aguenta dados em falta sem rebentar", () => {
    const bareWorkbook = new ExcelJS.Workbook();

    expect(() =>
      buildAnalyticsWorkbook(bareWorkbook, {}, META),
    ).not.toThrow();

    const bareSheet = bareWorkbook.getWorksheet("Resumo");
    const row = bareSheet.getRow(7);

    expect(row.getCell(3).value).toBe(0);
  });
});

describe("o ficheiro gerado", () => {
  it("é um xlsx válido que se volta a abrir com os mesmos valores", async () => {
    const buffer = await workbook.xlsx.writeBuffer();

    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(buffer);

    const reopenedSheet = reopened.getWorksheet("Resumo");

    expect(reopenedSheet).toBeDefined();
    expect(reopenedSheet.getCell("A1").value).toBe("Grupo");

    // Procura a linha do total de mensagens no ficheiro reaberto.
    let totalValue = null;
    reopenedSheet.eachRow((row) => {
      if (row.getCell(2).value === "Total" && row.getCell(3).value === 825) {
        totalValue = row.getCell(3).value;
      }
    });

    expect(totalValue).toBe(825);
  });
});

describe("folha de painel", () => {
  let panel;

  // Anatomia do cartão, a contar da faixa de cor no topo.
  // Guardar isto num sítio evita espalhar números mágicos pelos testes.
  const CARD_STRIP_ROW = 5;
  const CARD_VALUE_ROW = CARD_STRIP_ROW + 2;
  const CARD_COLUMNS = [1, 7, 13, 19];

  beforeEach(() => {
    panel = workbook.getWorksheet("Painel");
  });

  it("abre com uma faixa de cabeçalho", () => {
    // A âncora forte no topo é o que impede a folha de parecer morta:
    // sem ela, blocos claros sobre fundo claro não têm onde firmar
    // o olhar.
    expect(panel.getCell(1, 1).fill.fgColor.argb).toBe("FF191E3B");
    expect(panel.getCell(1, 1).font.color.argb).toBe("FFFFFFFF");
    expect(panel.getCell(2, 1).value).toContain("DIGIK");
  });

  it("vem a seguir à folha de dados", () => {
    // O Resumo abre primeiro porque é com ele que se trabalha;
    // o Painel é a vista de apresentação.
    expect(workbook.worksheets[0].name).toBe("Resumo");
    expect(workbook.worksheets[1].name).toBe("Painel");
  });

  it("mostra a grelha e não pinta o fundo", () => {
    expect(panel.views[0].showGridLines).toBe(true);
  });

  it("desenha quatro cartões com os totais", () => {
    // Cada cartão tem o número grande na terceira linha do bloco.
    const numbers = CARD_COLUMNS.map(
      (column) => panel.getCell(CARD_VALUE_ROW, column).value,
    );

    expect(numbers).toEqual([
      DATA.users.total,
      DATA.messages.total,
      DATA.automations.runsTotal,
      DATA.trackedLinks.totalClicks,
    ]);
  });

  it("pinta cada cartão com a sua cor, na barra e no número", () => {
    const strip = panel.getCell(CARD_STRIP_ROW, 1);
    const value = panel.getCell(CARD_VALUE_ROW, 1);

    expect(strip.fill.fgColor.argb).toBe("FF30A9E0");
    expect(value.font.color.argb).toBe("FF30A9E0");
    expect(value.font.size).toBe(20);

    // O corpo do cartão é branco: a cor vive na barra e no número.
    expect(panel.getCell(CARD_VALUE_ROW, 2).fill.fgColor.argb).toBe("FFFFFFFF");
  });

  it("deixa as goteiras sem cor e os cartões brancos", () => {
    // Sem fundo pintado, é o branco dos cartões que os destaca — e é
    // também o que esconde a grelha por baixo deles.
    const gutter = panel.getCell(CARD_VALUE_ROW, 6);
    const card = panel.getCell(CARD_VALUE_ROW, 2);

    expect(gutter.fill).toBeUndefined();
    expect(card.fill.fgColor.argb).toBe("FFFFFFFF");
  });

  it("pinta o fundo apenas no tema escuro, onde é indispensável", () => {
    // Num tema escuro sem fundo pintado a folha ficava branca por
    // baixo de blocos escuros.
    const darkWorkbook = new ExcelJS.Workbook();
    buildAnalyticsWorkbook(darkWorkbook, DATA, { ...META, theme: "dark" });

    const darkPanel = darkWorkbook.getWorksheet("Painel");

    expect(darkPanel.getCell(CARD_VALUE_ROW, 6).fill.fgColor.argb).toBe(
      "FF0F1420",
    );
    expect(darkPanel.views[0].showGridLines).toBe(false);
  });

  it("muda de tema com uma opção", () => {
    const darkWorkbook = new ExcelJS.Workbook();

    buildAnalyticsWorkbook(darkWorkbook, DATA, { ...META, theme: "dark" });

    const darkPanel = darkWorkbook.getWorksheet("Painel");

    expect(darkPanel.getCell(CARD_VALUE_ROW, 1).font.color.argb).toBe(
      "FF30A9E0",
    );
  });

  it("dá fundo branco aos painéis de barras", () => {
    // Encontra a linha do título do painel de mensagens.
    let panelRow = null;
    panel.eachRow((row, number) => {
      if (row.getCell(1).value === "MENSAGENS") panelRow = number;
    });

    expect(panelRow).not.toBeNull();
    expect(panel.getCell(panelRow, 1).fill.fgColor.argb).toBe("FFFFFFFF");
  });

  it("dá o mesmo azul aos quatro cartões", () => {
    // São quatro totais do mesmo tipo. Cores diferentes sugeririam
    // categorias que não existem.
    const cores = CARD_COLUMNS.map(
      (column) => panel.getCell(CARD_STRIP_ROW, column).fill.fgColor.argb,
    );

    expect(new Set(cores).size).toBe(1);
    expect(cores[0]).toBe("FF30A9E0");
  });

  it("usa um azul claro nas barras, para o número se ler por cima", () => {
    // O valor é desenhado sobre a barra. Com o azul primário, o texto
    // escuro perdia-se contra o fundo.
    const cores = panel.conditionalFormattings
      .flatMap((formatting) => formatting.rules)
      .filter((rule) => rule.type === "dataBar")
      .map((rule) => rule.color.argb);

    expect(cores).toHaveLength(3);
    expect(new Set(cores).size).toBe(1);
    expect(cores[0]).toBe("FF7CC2FF");
  });

  it("usa barras dentro da célula em vez de gráficos", () => {
    const bars = panel.conditionalFormattings.filter((formatting) =>
      formatting.rules.some((rule) => rule.type === "dataBar"),
    );

    // Três painéis: mensagens, operação e templates.
    expect(bars).toHaveLength(3);
  });

  it("faz as barras arrancarem do zero", () => {
    const [first] = panel.conditionalFormattings;
    const rule = first.rules.find((r) => r.type === "dataBar");

    // Deixar o mínimo flutuar faria a barra mais curta parecer vazia
    // e mentiria na comparação entre valores.
    expect(rule.cfvo[0]).toMatchObject({ type: "num", value: 0 });
    expect(rule.cfvo[1].type).toBe("max");
  });

  it("sai em paisagem, cabendo na largura da página", () => {
    expect(panel.pageSetup.orientation).toBe("landscape");
    expect(panel.pageSetup.fitToWidth).toBe(1);
  });
});

describe("identidade visual", () => {
  it("usa as cores do MyDigitalBot, não uma paleta inventada", () => {
    // Estes valores vêm de src/app/globals.css. Se alguém mudar a
    // marca lá, este teste avisa que o Excel ficou para trás.
    const panel = workbook.getWorksheet("Painel");
    const summary = workbook.getWorksheet("Resumo");

    // --ink, o navy estrutural, na faixa de cabeçalho.
    expect(panel.getCell(1, 1).fill.fgColor.argb).toBe("FF191E3B");

    // --brand-1, o cyan primário, no primeiro cartão e no cabeçalho
    // da tabela.
    expect(panel.getCell(5, 1).fill.fgColor.argb).toBe("FF30A9E0");
    expect(summary.getRow(1).getCell(1).fill.fgColor.argb).toBe("FF191E3B");
  });
});
