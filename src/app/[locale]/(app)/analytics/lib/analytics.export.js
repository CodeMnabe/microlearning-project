import { getPeriodLabelKey } from "./analytics.helpers";

export async function exportAnalyticsPdf({
  org,
  period,
  locale,
  translation,
  format,

  users,
  assistants,
  templates,
  messages,
  automations,
  scheduledBroadcasts,

  assistantCoverageRate,
  readRate,
  failedMessageRate,

  topTrackedLinks,
  dailyMessagesData,
  dailyClicksData,
  dailyAutomationRunsData,
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const periodLabel = translation(getPeriodLabelKey(period));

  function addFooter(pageNumber) {
    pdf.setFontSize(9);
    pdf.setTextColor(120, 130, 145);
    pdf.text(
      `Analytics report • ${periodLabel} • Página ${pageNumber}`,
      16,
      pageHeight - 10
    );
  }

  function addSectionTitle(title, y) {
    pdf.setFontSize(15);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont(undefined, "bold");
    pdf.text(title, 16, y);
  }

  const generatedAt = new Intl.DateTimeFormat(locale || "pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  // Página 1 — Capa
  pdf.setFillColor(48, 169, 224);
  pdf.rect(0, 0, pageWidth, 70, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(28);
  pdf.setFont(undefined, "bold");
  pdf.text("Analytics", 16, 32);

  pdf.setFontSize(13);
  pdf.setFont(undefined, "normal");
  pdf.text("Dashboard report", 16, 43);

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(14);
  pdf.setFont(undefined, "bold");
  pdf.text(org?.name || "Organization", 16, 92);

  pdf.setFontSize(11);
  pdf.setFont(undefined, "normal");
  pdf.setTextColor(82, 100, 122);
  pdf.text(`Período: ${periodLabel}`, 16, 104);
  pdf.text(`Gerado em: ${generatedAt}`, 16, 112);

  pdf.setFontSize(10);
  pdf.text(
    "Este relatório resume os principais indicadores de utilização, atividade, automações, links e evolução diária.",
    16,
    132,
    { maxWidth: pageWidth - 32 }
  );

  addFooter(1);

  // Página 2 — Métricas principais
  pdf.addPage();
  addSectionTitle("Resumo geral", 20);

  autoTable(pdf, {
    startY: 30,
    head: [["Métrica", "Valor", "Detalhe"]],
    body: [
      [
        translation("cards.users"),
        format(users.total),
        `${format(users.withAssistant)} com assistente, ${format(
          users.withoutAssistant
        )} sem assistente`,
      ],
      [
        translation("cards.assistants"),
        format(assistants.total),
        `${format(assistants.withoutOpenAiId)} sem OpenAI ID configurado`,
      ],
      [
        translation("cards.templates"),
        format(templates.total),
        `${format(templates.active)} ativos, ${format(
          templates.pending
        )} pendentes, ${format(templates.rejected)} rejeitados`,
      ],
      [
        translation("cards.assistantCoverage"),
        `${assistantCoverageRate}%`,
        `${format(users.withAssistant)}/${format(
          users.total
        )} utilizadores com assistente`,
      ],
    ],
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [48, 169, 224],
      textColor: [255, 255, 255],
    },
  });

  addSectionTitle("Atividade", pdf.lastAutoTable.finalY + 16);

  autoTable(pdf, {
    startY: pdf.lastAutoTable.finalY + 24,
    head: [["Métrica", "Valor", "Detalhe"]],
    body: [
      [
        translation("cards.messages"),
        format(messages.total),
        `${format(messages.whatsapp)} WhatsApp, ${format(messages.teams)} Teams`,
      ],
      [
        translation("cards.delivery"),
        format(messages.delivered),
        `${format(messages.read)} lidas, ${format(messages.failed)} falhadas`,
      ],
      [
        translation("cards.readRate"),
        `${readRate}%`,
        `${format(messages.read)} de ${format(messages.total)} mensagens`,
      ],
      [
        translation("cards.failureRate"),
        `${failedMessageRate}%`,
        `${format(messages.failed)} de ${format(messages.total)} mensagens`,
      ],
    ],
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [48, 169, 224],
      textColor: [255, 255, 255],
    },
  });

  addFooter(2);

  // Página 3 — Automações e links
  pdf.addPage();
  addSectionTitle("Automações", 20);

  autoTable(pdf, {
    startY: 30,
    head: [["Métrica", "Valor", "Detalhe"]],
    body: [
      [
        translation("cards.automations"),
        format(automations.rulesTotal),
        `${format(automations.rulesActive)} ativas, ${format(
          automations.rulesPaused
        )} pausadas`,
      ],
      [
        translation("cards.automationRuns"),
        format(automations.runsTotal),
        `${format(automations.runsProcessed)} processadas, ${format(
          automations.runsFailed
        )} falhadas`,
      ],
      [
        translation("cards.scheduledBroadcasts"),
        format(scheduledBroadcasts.total),
        `${format(scheduledBroadcasts.completed)} concluídas, ${format(
          scheduledBroadcasts.failed
        )} falhadas, ${format(
          scheduledBroadcasts.recipientCount
        )} destinatários`,
      ],
    ],
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [48, 169, 224],
      textColor: [255, 255, 255],
    },
  });

  addSectionTitle("Links mais clicados", pdf.lastAutoTable.finalY + 16);

  autoTable(pdf, {
    startY: pdf.lastAutoTable.finalY + 24,
    head: [
      [
        "#",
        translation("rankings.columns.link"),
        translation("rankings.columns.clicks"),
      ],
    ],
    body: topTrackedLinks.slice(0, 10).map((link, index) => [
      index + 1,
      link.label,
      format(link.clicks),
    ]),
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [48, 169, 224],
      textColor: [255, 255, 255],
    },
  });

  addFooter(3);

  // Página 4 — Evolução diária
  pdf.addPage();
  addSectionTitle("Evolução diária", 20);

  autoTable(pdf, {
    startY: 30,
    head: [["Data", "Mensagens", "Cliques", "Automações processadas"]],
    body: dailyMessagesData.map((item) => {
      const clickItem = dailyClicksData.find((row) => row.date === item.date);
      const automationItem = dailyAutomationRunsData.find(
        (row) => row.date === item.date
      );

      return [
        item.date,
        format(item.messages),
        format(clickItem?.clicks),
        format(automationItem?.processed),
      ];
    }),
    styles: {
      fontSize: 8,
      cellPadding: 2.4,
    },
    headStyles: {
      fillColor: [48, 169, 224],
      textColor: [255, 255, 255],
    },
  });

  addFooter(4);

  pdf.save(`analytics-${period}-${new Date().toISOString().slice(0, 10)}.pdf`);
}