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
    if (number <= 6) return;

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
    expect(workbook.worksheets).toHaveLength(1);
  });

  it("escreve o bloco de título acima da tabela", () => {
    expect(sheet.getCell("A1").value).toBe("Analytics");
    expect(sheet.getCell("A2").value).toBe("Organização: DIGIK");
    expect(sheet.getCell("A3").value).toBe("Período: Últimos 30 dias");
    expect(sheet.getCell("A4").value).toBe("Exportado em: 08/09/2026");
  });

  it("põe o cabeçalho na linha 6, pintado com a cor da marca", () => {
    const header = sheet.getRow(6);

    expect(header.getCell(1).value).toBe("Grupo");
    expect(header.getCell(4).value).toBe("Taxa");
    expect(header.getCell(1).font.bold).toBe(true);
    expect(header.getCell(1).fill.fgColor.argb).toBe("FF1D6B58");
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

  it("fixa o cabeçalho e liga os filtros", () => {
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 6 });
    expect(sheet.autoFilter.from).toBe("A6");
    expect(sheet.autoFilter.to).toMatch(/^D\d+$/);
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
    expect(reopenedSheet.getCell("A1").value).toBe("Analytics");

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
