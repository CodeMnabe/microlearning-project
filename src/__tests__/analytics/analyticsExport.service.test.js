// @vitest-environment node

/**
 * Testes do dataset de detalhe da exportação.
 *
 * Os repos são mockados: o que se testa aqui é a composição — que o
 * período atravessa todas as consultas, que os nomes das regras entram
 * nas execuções, e que as linhas saem planas para quem escreve a folha.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getAutomationRunRows: vi.fn(),
  getAutomationRuleNames: vi.fn(),
  getScheduledBroadcastRows: vi.fn(),
  getTrackedLinkReportsByOrg: vi.fn(),
  getMessageRows: vi.fn(),
  getUserRows: vi.fn(),
  getTemplateRows: vi.fn(),
}));

vi.mock("@/lib/repos/analytics/analyticsExport.repo", () => ({
  getAutomationRunRows: mocks.getAutomationRunRows,
  getAutomationRuleNames: mocks.getAutomationRuleNames,
  getScheduledBroadcastRows: mocks.getScheduledBroadcastRows,
  getMessageRows: mocks.getMessageRows,
  getUserRows: mocks.getUserRows,
  getTemplateRows: mocks.getTemplateRows,
}));

vi.mock("@/lib/repos/broadcast/trackedLinks.repo", () => ({
  getTrackedLinkReportsByOrg: mocks.getTrackedLinkReportsByOrg,
}));

import { getAnalyticsExportDataset } from "@/lib/services/analytics/analyticsExport.service";

beforeEach(() => {
  vi.clearAllMocks();

  mocks.getAutomationRunRows.mockResolvedValue([]);
  mocks.getAutomationRuleNames.mockResolvedValue(new Map());
  mocks.getScheduledBroadcastRows.mockResolvedValue([]);
  mocks.getTrackedLinkReportsByOrg.mockResolvedValue([]);
  mocks.getMessageRows.mockResolvedValue([]);
  mocks.getUserRows.mockResolvedValue([]);
  mocks.getTemplateRows.mockResolvedValue([]);
});

describe("getAnalyticsExportDataset", () => {
  it("leva o período a todas as consultas", async () => {
    // Se alguma ficasse de fora, os totais do Resumo não bateriam
    // certo com as linhas de detalhe por baixo deles.
    await getAnalyticsExportDataset({ orgId: 7, period: "30d" });

    const [, runsPeriod] = mocks.getAutomationRunRows.mock.calls[0];
    const [, scheduledPeriod] = mocks.getScheduledBroadcastRows.mock.calls[0];
    const [, linksPeriod] = mocks.getTrackedLinkReportsByOrg.mock.calls[0];

    expect(runsPeriod).toBeTruthy();
    expect(scheduledPeriod).toBeTruthy();
    expect(linksPeriod).toBeTruthy();
  });

  it("não filtra nada quando o período é 'all'", async () => {
    await getAnalyticsExportDataset({ orgId: 7, period: "all" });

    const [, runsPeriod] = mocks.getAutomationRunRows.mock.calls[0];

    expect(runsPeriod).toBeNull();
  });

  it("rejeita um período inválido com 400", async () => {
    await expect(
      getAnalyticsExportDataset({ orgId: 7, period: "banana" }),
    ).rejects.toMatchObject({ message: "Invalid period", status: 400 });
  });

  it("troca o id da regra pelo nome dela", async () => {
    mocks.getAutomationRunRows.mockResolvedValue([
      {
        id: 1,
        rule_id: 42,
        status: "sent",
        created_at: "2026-09-01T10:00:00Z",
        user_row: { id: 5, name: "Ana", email: "ana@digik.pt" },
      },
    ]);
    mocks.getAutomationRuleNames.mockResolvedValue(
      new Map([[42, "Boas-vindas"]]),
    );

    const result = await getAnalyticsExportDataset({ orgId: 7, period: "all" });

    expect(result.automationRuns[0]).toMatchObject({
      id: 1,
      rule: "Boas-vindas",
      ruleId: 42,
      status: "sent",
      userName: "Ana",
      userEmail: "ana@digik.pt",
    });
  });

  it("aguenta uma execução sem regra e sem utilizador", async () => {
    mocks.getAutomationRunRows.mockResolvedValue([
      { id: 2, rule_id: 999, status: "failed", user_row: null },
    ]);

    const result = await getAnalyticsExportDataset({ orgId: 7, period: "all" });

    // Uma regra apagada ou um utilizador removido não podem rebentar
    // a exportação inteira.
    expect(result.automationRuns[0]).toMatchObject({
      rule: null,
      userName: null,
      userEmail: null,
    });
  });

  it("achata as linhas para quem escreve a folha", async () => {
    mocks.getScheduledBroadcastRows.mockResolvedValue([
      {
        id: 3,
        status: "completed",
        channel: "whatsapp",
        scheduled_for: "2026-09-02T09:00:00Z",
        recipient_count: 120,
        started_at: "2026-09-02T09:00:05Z",
        completed_at: "2026-09-02T09:04:00Z",
        created_at: "2026-09-01T18:00:00Z",
      },
    ]);

    const result = await getAnalyticsExportDataset({ orgId: 7, period: "all" });

    // Sem underscores e sem aninhamento: uma coluna por célula.
    expect(result.scheduledBroadcasts[0]).toEqual({
      id: 3,
      status: "completed",
      channel: "whatsapp",
      scheduledFor: "2026-09-02T09:00:00Z",
      recipientCount: 120,
      startedAt: "2026-09-02T09:00:05Z",
      completedAt: "2026-09-02T09:04:00Z",
      createdAt: "2026-09-01T18:00:00Z",
    });
  });

  it("conta cada conjunto para o cliente poder confirmar", async () => {
    mocks.getAutomationRunRows.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mocks.getTrackedLinkReportsByOrg.mockResolvedValue([{ groupKey: "a" }]);

    const result = await getAnalyticsExportDataset({ orgId: 7, period: "all" });

    expect(result.counts).toEqual({
      messages: 0,
      users: 0,
      templates: 0,
      automationRuns: 2,
      scheduledBroadcasts: 0,
      trackedLinkGroups: 1,
    });
  });

  it("não leva o conteúdo das mensagens no ficheiro", async () => {
    // O repo não pede a coluna, portanto ela não chega aqui. Este teste
    // guarda a decisão: se alguém ligar a constante sem pensar, isto
    // não impede — mas se alguém a acrescentar por engano no mapeamento,
    // apanha.
    mocks.getMessageRows.mockResolvedValue([
      {
        id: 1,
        created_at: "2026-09-01T10:00:00Z",
        channel: "whatsapp",
        role: "assistant",
      },
    ]);

    const result = await getAnalyticsExportDataset({ orgId: 7, period: "all" });

    expect(result.messages[0]).not.toHaveProperty("content");
  });

  it("junta as etiquetas do utilizador numa só célula", async () => {
    // Uma célula de folha de cálculo não guarda listas, e uma coluna
    // por etiqueta mudaria de forma consoante a organização.
    mocks.getUserRows.mockResolvedValue([
      {
        id: 5,
        name: "Ana",
        email: "ana@digik.pt",
        user_tag: [
          { tag: { id: 1, name: "Formação" } },
          { tag: { id: 2, name: "Piloto" } },
        ],
      },
    ]);

    const result = await getAnalyticsExportDataset({ orgId: 7, period: "all" });

    expect(result.users[0].tags).toBe("Formação, Piloto");
  });

  it("aguenta um utilizador sem etiquetas", async () => {
    mocks.getUserRows.mockResolvedValue([{ id: 6, name: "Rui" }]);

    const result = await getAnalyticsExportDataset({ orgId: 7, period: "all" });

    expect(result.users[0].tags).toBe("");
  });

  it("não filtra os utilizadores por período", async () => {
    // Um export de utilizadores é o retrato de quem existe agora.
    // Filtrar por data de criação daria uma lista incompleta: as
    // mensagens do período podem ser de pessoas registadas antes dele.
    await getAnalyticsExportDataset({ orgId: 7, period: "30d" });

    expect(mocks.getUserRows).toHaveBeenCalledWith(7);
    expect(mocks.getUserRows.mock.calls[0]).toHaveLength(1);
  });
  it("traduz org_id nulo em ambito global", async () => {
    mocks.getTemplateRows.mockResolvedValue([
      { id: 1, name: "meu", org_id: 7 },
      { id: 2, name: "partilhado", org_id: null },
    ]);

    const result = await getAnalyticsExportDataset({ orgId: 7, period: "all" });

    expect(result.templates.map((t) => t.scope)).toEqual(["org", "global"]);
  });

  it("não filtra os templates por período", async () => {
    // Um template não é um acontecimento datado: existe ou não existe.
    await getAnalyticsExportDataset({ orgId: 7, period: "30d" });

    expect(mocks.getTemplateRows).toHaveBeenCalledWith(7);
  });
});
