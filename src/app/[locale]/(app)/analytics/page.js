
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CheckCircle2,
  FileText,
  MessageSquare,
  MousePointerClick,
  RefreshCw,
  Send,
  Users,
  Zap,
  Info,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import styles from "./analytics.module.css";

 

/**
 * Opções disponíveis para filtrar as métricas por período.
 */
const PERIOD_OPTIONS = [
  { value: "all", labelKey: "periods.all" },
  { value: "7d", labelKey: "periods.last7Days" },
  { value: "30d", labelKey: "periods.last30Days" },
  { value: "90d", labelKey: "periods.last90Days" },
];

/**
 * Chave usada no localStorage para guardar os grupos de métricas visíveis.
 */
const METRIC_GROUP_STORAGE_KEY = "analytics.visibleMetricGroups";

/**
 * Grupos de métricas visíveis por default.
 */
const DEFAULT_VISIBLE_METRIC_GROUPS = {
  overview: true,
  activity: true,
  automations: true,
  engagement: true,
  health: true,
};

/**
 * Chave usada no localStorage para guardar as secções de gráficos visíveis.
 */
const CHART_SECTION_STORAGE_KEY = "analytics.visibleChartSections";

/**
 * Secções de gráficos visíveis por defeito.
 */
const DEFAULT_VISIBLE_CHART_SECTIONS = {
  distribution: true,
  trends: true,
};

/**
 * Calcula uma percentagem de forma segura.
 * Evita erros quando o total é 0.
 */
function safePercent(part, total) {
  const partNumber = safeNumber(part);
  const totalNumber = safeNumber(total);

  if (totalNumber <= 0) return 0;

  return Math.round((partNumber / totalNumber) * 100);
}

/**
 * Converte um valor para número de forma segura.
 */
function safeNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

/**
 * Formata a data dos gráficos diários de acordo com o idioma atual.
 */
function formatDateLabel(date, locale) {
  const parsedDate = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
  }).format(parsedDate);
}

function DescriptionInfo({ text }){
  const [isOpen, setIsOpen] = useState(false);

  if (!text) return null;

  return(
    <span className={styles.infoWrapper}>
      <button
      type="button"
      className={styles.infoButton}
      onClick={() => setIsOpen((currentValue) => !currentValue)}
      arial-label= "Mostrar informação"
      aria-expanded={isOpen}
      >
        <Info size={14} />
      </button>

      {isOpen && (
        <span className= {styles.infoPopover}>
          {text}
          </span>
      )}

    </span>
  )

}

/**
 * Card reutilizável para mostrar uma métrica individual.
 */
function MetricCard({ icon: Icon, title, value, description, tone = "default" }) {
  return (
    <article className={`${styles.card} ${styles[tone] || ""}`}>
      <div className={styles.cardIcon}>
        <Icon size={20} />
      </div>

      <div>
        <div className={styles.cardLabel}>{title}</div>
        <div className={styles.cardValue}>{value}</div>

        {description && (
          <div className={styles.cardHelper}>{description}</div>
        )}
      </div>
    </article>
  );
}

/**
 * Grupo reutilizável de cards de métricas.
 * Permite mostrar ou ocultar um conjunto de cards.
 */
function MetricGroup({
  title,
  description,
  children,
  isVisible = true,
  onToggle,
  showLabel,
  hideLabel,
  className = "",
}) {
  return (
    <section
      className={`${styles.metricGroup} ${className} ${
        !isVisible ? styles.metricGroupCollapsed : ""
      }`}
    >
      <div className={styles.metricGroupHeader}>
        <div>
        <div className={styles.titleWithInfo}>
        <h2 className={styles.metricGroupTitle}>{title}</h2>
        <DescriptionInfo text={description} />
      </div>
        </div>

        {onToggle && (
          <button
            type="button"
            className={styles.metricGroupToggle}
            onClick={onToggle}
          >
            {isVisible ? hideLabel : showLabel}
          </button>
        )}
      </div>

      {isVisible && <div className={styles.metricGroupGrid}>{children}</div>}
    </section>
  );
}

/**
 * Card com gráfico de barras.
 * Usado para mostrar distribuições e comparações por categoria.
 */
function ChartCard({ title, description, data }) {
  const hasData = data.some((item) => safeNumber(item.value) > 0);

  return (
    <section className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h2 className={styles.chartTitle}>{title}</h2>

        {description && (
          <p className={styles.chartDescription}>{description}</p>
        )}
      </div>

      <div className={styles.chartBox}>
        {hasData ? (
         <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="28%" barGap={8}>
            <CartesianGrid strokeDasharray="1 1" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar
              dataKey="value"
              fill="var(--brand-1)"
              radius={[8, 8, 0, 0]}
              barSize={54}
            />
          </BarChart>
</ResponsiveContainer>
        ) : (
          <div className={styles.chartEmpty}>Sem dados para mostrar.</div>
        )}
      </div>
    </section>
  );
}

/**
 * Card com gráfico de linha.
 * Usado para mostrar evolução diária.
 */
function TrendChartCard({
  title,
  description,
  data,
  dataKey,
  locale,
  emptyMessage,
}) {
  const hasData = data.some((item) => safeNumber(item[dataKey]) > 0);

  const chartData = data.map((item) => ({
    ...item,
    label: formatDateLabel(item.date, locale),
  }));

  return (
    <section className={styles.chartCard}>
      <div className={styles.chartHeader}>

      <div className={styles.titleWithInfo}>
        <div className={styles.titleWithInfo}>
        <h2 className={styles.chartTitle}>{title}</h2>
        <DescriptionInfo text={description} />
      </div>
      </div>

      </div>

      <div className={styles.chartBox}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" minTickGap={20} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke="var( --brand-1)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className={styles.chartEmpty}>{emptyMessage}</div>
        )}
      </div>
    </section>
  );
}

/**
 * Tabela reutilizável para rankings.
 * Recebe colunas dinâmicas e linhas vindas da API.
 */
function RankingTable({
  title,
  description,
  columns,
  rows,
  emptyMessage,
  splitTopTen = false,
  footer,
}) {
  const visibleRows = splitTopTen ? rows.slice(0, 10) : rows;

  const shouldSplit = splitTopTen && visibleRows.length > 5;

  const rowGroups = shouldSplit
    ? [visibleRows.slice(0, 5), visibleRows.slice(5, 10)]
    : [visibleRows];

  return (
    <section className={styles.rankingCard}>
      <div className={styles.chartHeader}>
        <div className={styles.titleWithInfo}>
          <h2 className={styles.chartTitle}>{title}</h2>
          <DescriptionInfo text={description} />
        </div>
      </div>

      {visibleRows.length > 0 ? (
        <div
          className={`${styles.tableWrapper} ${
            shouldSplit ? styles.splitTableWrapper : ""
          }`}
        >
          {rowGroups.map((groupRows, groupIndex) => (
            <table key={groupIndex} className={styles.rankingTable}>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {groupRows.map((row, index) => {
                  const globalIndex = groupIndex === 0 ? index : index + 5;

                  return (
                    <tr key={row.id || `${groupIndex}-${index}`}>
                      {columns.map((column) => (
                        <td key={column.key}>
                          {column.render
                            ? column.render(row, globalIndex)
                            : row[column.key]}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}
        </div>
      ) : (
        <div className={styles.chartEmpty}>{emptyMessage}</div>
      )}

      {footer}
    </section>
  );
}
/**
 * Página principal de Analytics.
 * Carrega dados da API e apresenta a dashboard.
 */
export default function AnalyticsPage() {
  // Traduções e idioma atual.
  const translation = useTranslations("Analytics");
  const locale = useLocale();

  // Dados do utilizador, organização e loader global.
  const { user, loading: authLoading } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const { startLoading, stopLoading } = useGlobalLoader();

  // ID da organização atual.
  const orgId = org?.id;

  // Estados principais da dashboard.
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("all");
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isFullLinksListOpen, setIsFullLinksListOpen] = useState(false);

  // Estado dos grupos de métricas visíveis.
  const [visibleMetricGroups, setVisibleMetricGroups] = useState(
    DEFAULT_VISIBLE_METRIC_GROUPS
  );

  // Estado das secções de gráficos visíveis.
  const [visibleChartSections, setVisibleChartSections] = useState(
    DEFAULT_VISIBLE_CHART_SECTIONS
  );

  

  /**
   * Carrega do localStorage os grupos de métricas que o utilizador quer ver.
   */
  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(
        METRIC_GROUP_STORAGE_KEY
      );

      if (!storedValue) return;

      const parsedValue = JSON.parse(storedValue);

      setVisibleMetricGroups({
        ...DEFAULT_VISIBLE_METRIC_GROUPS,
        ...parsedValue,
      });
    } catch (err) {
      console.error(
        "[analytics] Failed to load metric group preferences:",
        err
      );
    }
  }, []);

  /**
   * Guarda no localStorage os grupos de métricas visíveis.
   */
  useEffect(() => {
    try {
      window.localStorage.setItem(
        METRIC_GROUP_STORAGE_KEY,
        JSON.stringify(visibleMetricGroups)
      );
    } catch (err) {
      console.error(
        "[analytics] Failed to save metric group preferences:",
        err
      );
    }
  }, [visibleMetricGroups]);

  /**
   * Carrega do localStorage as secções de gráficos que o utilizador quer ver.
   */
  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(
        CHART_SECTION_STORAGE_KEY
      );

      if (!storedValue) return;

      const parsedValue = JSON.parse(storedValue);

      setVisibleChartSections({
        ...DEFAULT_VISIBLE_CHART_SECTIONS,
        ...parsedValue,
      });
    } catch (err) {
      console.error(
        "[analytics] Failed to load chart section preferences:",
        err
      );
    }
  }, []);

  /**
   * Guarda no localStorage as secções de gráficos visíveis.
   */
  useEffect(() => {
    try {
      window.localStorage.setItem(
        CHART_SECTION_STORAGE_KEY,
        JSON.stringify(visibleChartSections)
      );
    } catch (err) {
      console.error(
        "[analytics] Failed to save chart section preferences:",
        err
      );
    }
  }, [visibleChartSections]);

  /**
   * Formatador de números de acordo com o idioma atual.
   */
  const formatter = useMemo(() => {
    return new Intl.NumberFormat(locale || "pt-PT");
  }, [locale]);

  /**
   * Formata valores numéricos para apresentação.
   */
  function format(value) {
    return formatter.format(safeNumber(value));
  }

  /**
   * Mostra ou oculta um grupo de métricas.
   */
  function toggleMetricGroup(groupKey) {
    setVisibleMetricGroups((currentGroups) => ({
      ...currentGroups,
      [groupKey]: !currentGroups[groupKey],
    }));
  }


  /**
   * Mostra ou oculta uma secção de gráficos.
   */
  function toggleChartSection(sectionKey) {
    setVisibleChartSections((currentSections) => ({
      ...currentSections,
      [sectionKey]: !currentSections[sectionKey],
    }));
  }

  

  function resetDashboardView() {
  setVisibleMetricGroups({ ...DEFAULT_VISIBLE_METRIC_GROUPS });
  setVisibleChartSections({ ...DEFAULT_VISIBLE_CHART_SECTIONS });
}



  async function handleExportPdf() {
  if (!metrics) return;

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

  function addFooter(pageNumber) {
    pdf.setFontSize(9);
    pdf.setTextColor(120, 130, 145);
    pdf.text(
      `Analytics report • ${translation(`periods.${period === "all" ? "all" : period === "7d" ? "last7Days" : period === "30d" ? "last30Days" : "last90Days"}`)} • Página ${pageNumber}`,
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
  pdf.text(`Período: ${translation(`periods.${period === "all" ? "all" : period === "7d" ? "last7Days" : period === "30d" ? "last30Days" : "last90Days"}`)}`, 16, 104);
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
        `${format(users.withAssistant)} com assistente, ${format(users.withoutAssistant)} sem assistente`,
      ],
      [
        translation("cards.assistants"),
        format(assistants.total),
        `${format(assistants.withoutOpenAiId)} sem OpenAI ID configurado`,
      ],
      [
        translation("cards.templates"),
        format(templates.total),
        `${format(templates.active)} ativos, ${format(templates.pending)} pendentes, ${format(templates.rejected)} rejeitados`,
      ],
      [
        translation("cards.assistantCoverage"),
        `${assistantCoverageRate}%`,
        `${format(users.withAssistant)}/${format(users.total)} utilizadores com assistente`,
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
        `${format(automations.rulesActive)} ativas, ${format(automations.rulesPaused)} pausadas`,
      ],
      [
        translation("cards.automationRuns"),
        format(automations.runsTotal),
        `${format(automations.runsProcessed)} processadas, ${format(automations.runsFailed)} falhadas`,
      ],
      [
        translation("cards.scheduledBroadcasts"),
        format(scheduledBroadcasts.total),
        `${format(scheduledBroadcasts.completed)} concluídas, ${format(scheduledBroadcasts.failed)} falhadas, ${format(scheduledBroadcasts.recipientCount)} destinatários`,
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
    head: [["#", translation("rankings.columns.link"), translation("rankings.columns.clicks")]],
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


  /**
   * Carrega métricas da API para a organização e período atual.
   */
  const loadMetrics = useCallback(async () => {
    if (!orgId) return;

    setError("");
    setIsLoadingMetrics(true);
    startLoading();

    try {
      const res = await fetch(
        `/api/analytics/overview?orgId=${orgId}&period=${period}`,
        {
          cache: "no-store",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load analytics.");
      }

      setMetrics(data);
    } catch (err) {
      console.warn("[Analytics] load error:", err);
      setError(translation("errors.load"));
    } finally {
      setIsLoadingMetrics(false);
      stopLoading();
    }
  }, [orgId, period, startLoading, stopLoading, translation]);

  /**
   * Recarrega as métricas quando a organização ou o período muda.
   */
  useEffect(() => {
    if (authLoading || orgLoading || !orgId) return;

    loadMetrics();
  }, [authLoading, orgLoading, orgId, loadMetrics]);

 
 

  // Dados recebidos da API, separados por grupo.
  const users = metrics?.users ?? {};
  const assistants = metrics?.assistants ?? {};
  const templates = metrics?.templates ?? {};
  const messages = metrics?.messages ?? {};
  const automations = metrics?.automations ?? {};
  const scheduledBroadcasts = metrics?.scheduledBroadcasts ?? {};
  const trackedLinks = metrics?.trackedLinks ?? {};
  const pendingOutreach = metrics?.pendingOutreach ?? {};
  const daily = metrics?.daily ?? {};
  const rankings = metrics?.rankings ?? {};

  // Rankings recebidos da API.
  const topTrackedLinks = rankings.topTrackedLinks ?? [];
  const allTrackedLinks = rankings.topTrackedLinks ?? [];
 

  // Dados usados nos gráficos diários.
  const dailyMessagesData = daily.messages ?? [];
  const dailyClicksData = daily.clicks ?? [];
 
  const dailyAutomationRunsData = daily.automationRuns ?? [];

  // Percentagens calculadas para os cards.
  const assistantCoverageRate = safePercent(users.withAssistant, users.total);
  
  const readRate = safePercent(messages.read, messages.total);
  const failedMessageRate = safePercent(messages.failed, messages.total);



  const clickPerLinkRate = safePercent(
    trackedLinks.totalClicks,
    trackedLinks.totalLinks
  );

 

  // Dados do gráfico de mensagens por canal.
  const messagesChartData = [
    {
      name: "WhatsApp",
      value: safeNumber(messages.whatsapp),
    },
    {
      name: "Teams",
      value: safeNumber(messages.teams),
    },
  ];

  // Dados do gráfico de estado dos templates.
  const templatesChartData = [
    {
      name: translation("charts.active"),
      value: safeNumber(templates.active),
    },
    {
      name: translation("charts.pending"),
      value: safeNumber(templates.pending),
    },
    {
      name: translation("charts.rejected"),
      value: safeNumber(templates.rejected),
    },
  ];

 

  return (
    <main className={styles.page}>
      {/* Cabeçalho da página com título, nota, filtros e botão de refresh */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{translation("title")}</h1>
          

          
        </div>

        <div className={styles.headerActions}>
          {/* Botões de filtro por período */}
          <div
            className={styles.periodTabs}
            aria-label={translation("periods.label")}
          >
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.periodButton} ${
                  period === option.value ? styles.periodButtonActive : ""
                }`}
                onClick={() => setPeriod(option.value)}
                disabled={!orgId || isLoadingMetrics}
              >
                {translation(option.labelKey)}
              </button>
            ))}
          </div>

          {/* Botão para recarregar métricas manualmente */}
          <button
            type="button"
            className={styles.refreshButton}
            onClick={loadMetrics}
            disabled={!orgId || isLoadingMetrics}
          >
            <RefreshCw
              size={16}
              className={isLoadingMetrics ? styles.spinIcon : ""}
            />
            {isLoadingMetrics ? translation("loading") : translation("refresh")}
          </button>
        </div>
      </header>

      {/* Mensagem quando não existe organização associada */}
      {!orgId && !authLoading && !orgLoading && (
        <div className={styles.errorBox}>{translation("errors.noOrg")}</div>
      )}

      {/* Mensagem de erro ao carregar dados */}
      {error && <div className={styles.errorBox}>{error}</div>}

      {/* Estado inicial enquanto ainda não há métricas */}
      {!metrics && !error ? (
        <div className={styles.empty}>{translation("loading")}</div>
      ) : null}

      {metrics && (
        <>

      
          
          {/* Grupos principais de cards de métricas */}
          <div className={styles.metricGroups}>

            <MetricGroup className={styles.review}
              title={translation("groups.overview.title")}
              description={translation("groups.overview.description")}
              
              showLabel={translation("customization.show")}
              hideLabel={translation("customization.hide")}
            >
                

              
              <MetricCard
                icon={Users}
                title={translation("cards.users")}
                value={format(users.total)}
                description={translation("cards.usersHelper", {
                  withAssistant: format(users.withAssistant),
                  withoutAssistant: format(users.withoutAssistant),
                })}
              />

              <MetricCard
                icon={Bot}
                title={translation("cards.assistants")}
                value={format(assistants.total)}
                description={translation("cards.assistantsHelper", {
                  withoutOpenAiId: format(assistants.withoutOpenAiId),
                })}
                tone={
                  safeNumber(assistants.withoutOpenAiId) > 0
                    ? "warning"
                    : "default"
                }
              />

              <MetricCard
                icon={FileText}
                title={translation("cards.templates")}
                value={format(templates.total)}
                description={translation("cards.templatesHelper", {
                  active: format(templates.active),
                  pending: format(templates.pending),
                  rejected: format(templates.rejected),
                })}
                tone={safeNumber(templates.rejected) > 0 ? "warning" : "default"}
              />

              <MetricCard
                icon={Users}
                title={translation("cards.assistantCoverage")}
                value={`${assistantCoverageRate}%`}
                description={translation("cards.assistantCoverageHelper", {
                  withAssistant: format(users.withAssistant),
                  total: format(users.total),
                })}
                tone={assistantCoverageRate < 100 ? "warning" : "default"}
              />
            </MetricGroup>

              {/* Barra de personalização da dashboard */}
         
          <div className={styles.dashboardQuickActions}>
            <button
              type="button"
              className={styles.customizationResetButton}
              onClick={resetDashboardView}
            >
              {translation("customization.resetDashboard")}
            </button>

            <button
              type="button"
                className={`${styles.customizationResetButton} ${styles.exportButton}`}
              onClick={handleExportPdf}
            >
              {translation("customization.exports")}
            </button>
          </div>

            <MetricGroup
              title={translation("groups.activity.title")}
              description={translation("groups.activity.description")}
              isVisible={visibleMetricGroups.activity}
              onToggle={() => toggleMetricGroup("activity")}
              showLabel={translation("customization.show")}
              hideLabel={translation("customization.hide")}
            >
              <MetricCard
                icon={MessageSquare}
                title={translation("cards.messages")}
                value={format(messages.total)}
                description={translation("cards.messagesHelper", {
                  whatsapp: format(messages.whatsapp),
                  teams: format(messages.teams),
                })}
              />

              <MetricCard
                icon={CheckCircle2}
                title={translation("cards.delivery")}
                value={format(messages.delivered)}
                description={translation("cards.deliveryHelper", {
                  read: format(messages.read),
                  failed: format(messages.failed),
                })}
                tone={safeNumber(messages.failed) > 0 ? "warning" : "default"}
              />

              <MetricCard
                icon={CheckCircle2}
                title={translation("cards.readRate")}
                value={`${readRate}%`}
                description={translation("cards.readRateHelper", {
                  read: format(messages.read),
                  total: format(messages.total),
                })}
              />

              <MetricCard
                icon={AlertTriangle}
                title={translation("cards.failureRate")}
                value={`${failedMessageRate}%`}
                description={translation("cards.failureRateHelper", {
                  failed: format(messages.failed),
                  total: format(messages.total),
                })}
                tone={failedMessageRate > 0 ? "warning" : "default"}
              />

              <MetricCard
                icon={MessageSquare}
                title={translation("cards.pendingOutreach")}
                value={format(pendingOutreach.total)}
                description={translation("cards.pendingOutreachHelper", {
                  active: format(pendingOutreach.active),
                })}
              />
            </MetricGroup>

            <MetricGroup
              title={translation("groups.automations.title")}
              description={translation("groups.automations.description")}
              isVisible={visibleMetricGroups.automations}
              onToggle={() => toggleMetricGroup("automations")}
              showLabel={translation("customization.show")}
              hideLabel={translation("customization.hide")}
            >
              <MetricCard
                icon={Zap}
                title={translation("cards.automations")}
                value={format(automations.rulesTotal)}
                description={translation("cards.automationsHelper", {
                  active: format(automations.rulesActive),
                  paused: format(automations.rulesPaused),
                })}
              />

              <MetricCard
                icon={Send}
                title={translation("cards.automationRuns")}
                value={format(automations.runsTotal)}
                description={translation("cards.automationRunsHelper", {
                  processed: format(automations.runsProcessed),
                  failed: format(automations.runsFailed),
                })}
                tone={
                  safeNumber(automations.runsFailed) > 0
                    ? "warning"
                    : "default"
                }
              />

              <MetricCard
                icon={CalendarClock}
                title={translation("cards.scheduledBroadcasts")}
                value={format(scheduledBroadcasts.total)}
                description={translation("cards.scheduledBroadcastsHelper", {
                  queued: format(scheduledBroadcasts.queued),
                  completed: format(scheduledBroadcasts.completed),
                  failed: format(scheduledBroadcasts.failed),
                  recipients: format(scheduledBroadcasts.recipientCount),
                })}
                tone={
                  safeNumber(scheduledBroadcasts.failed) > 0
                    ? "warning"
                    : "default"
                }
              />
            </MetricGroup>

            <MetricGroup
              title={translation("groups.engagement.title")}
              description={translation("groups.engagement.description")}
              isVisible={visibleMetricGroups.engagement}
              onToggle={() => toggleMetricGroup("engagement")}
              showLabel={translation("customization.show")}
              hideLabel={translation("customization.hide")}
            >
              <MetricCard
                icon={MousePointerClick}
                title={translation("cards.trackedLinks")}
                value={format(trackedLinks.totalClicks)}
                description={translation("cards.trackedLinksHelper", {
                  links: format(trackedLinks.totalLinks),
                })}
              />

              <MetricCard
                icon={MousePointerClick}
                title={translation("cards.clickDensity")}
                value={`${clickPerLinkRate}%`}
                description={translation("cards.clickDensityHelper", {
                  clicks: format(trackedLinks.totalClicks),
                  links: format(trackedLinks.totalLinks),
                })}
              />
            </MetricGroup>

            
          </div>

          {/* Secção de gráficos de distribuição */}
          <section
            className={`${styles.section} ${
              !visibleChartSections.distribution
                ? styles.sectionCollapsed
                : ""
            }`}
          >
            <div className={styles.sectionHeader}>
              <div>
                <div className={styles.titleWithInfo}>
                <h2 className={styles.sectionTitle}>
                  {translation("charts.sectionTitle")}
                </h2>

                <DescriptionInfo text={translation("charts.sectionDescription")} />
              </div>
              </div>

              <button
                type="button"
                className={styles.metricGroupToggle}
                onClick={() => toggleChartSection("distribution")}
              >
                {visibleChartSections.distribution
                  ? translation("customization.hide")
                  : translation("customization.show")}
              </button>
            </div>

            {visibleChartSections.distribution && (
              <div className={styles.distributionChartGrid}>
                

                <ChartCard
                  title={translation("charts.messagesTitle")}
                  description={translation("charts.messagesDescription")}
                  data={messagesChartData}
                />

                <ChartCard
                  title={translation("charts.templatesTitle")}
                  description={translation("charts.templatesDescription")}
                  data={templatesChartData}
                />

              </div>
            )}
          </section>

          {/* Secção de rankings */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
              <div className={styles.titleWithInfo}>
              <h2 className={styles.sectionTitle}>
                {translation("rankings.title")}
              </h2>

              <DescriptionInfo text={translation("rankings.description")} />
            </div>
              </div>
            </div>

            <div className={styles.rankingGrid}>
              <RankingTable
                title={translation("rankings.topLinksTitle")}
                description={translation("rankings.topLinksDescription")}
                rows={topTrackedLinks}
                emptyMessage={translation("rankings.empty")}
                splitTopTen
                footer={
                  allTrackedLinks.length > 10 ? (
                    <button
                      type="button"
                      className={styles.viewAllButton}
                      onClick={() => setIsFullLinksListOpen(true)}
                    >
                      {translation("rankings.viewAllLinks", {
                        count: format(allTrackedLinks.length),
                      })}
                    </button>
                  ) : null
                }
                columns={[
                  {
                    key: "position",
                    label: "#",
                    render: (_row, index) => (
                      <span className={styles.rankingPosition}>{index + 1}</span>
                    ),
                  },
                  {
                    key: "label",
                    label: translation("rankings.columns.link"),
                    render: (row) => (
                      <span className={styles.rankingMainText}>
                        {row.label}
                      </span>
                    ),
                  },
                  {
                    key: "clicks",
                    label: translation("rankings.columns.clicks"),
                    render: (row) => format(row.clicks),
                  },
                ]}
              />

            </div>
          </section>

                          {isFullLinksListOpen && (
            <div
              className={styles.modalBackdrop}
              onClick={() => setIsFullLinksListOpen(false)}
            >
              <section
                className={styles.linksModal}
                onClick={(event) => event.stopPropagation()}
              >
                <div className={styles.linksModalHeader}>
                  <div className={styles.titleWithInfo}>
                    <h2 className={styles.sectionTitle}>
                      {translation("rankings.allLinksTitle")}
                    </h2>

                    <DescriptionInfo text={translation("rankings.allLinksDescription")} />
                  </div>

                  <button
                    type="button"
                    className={styles.modalCloseButton}
                    onClick={() => setIsFullLinksListOpen(false)}
                  >
                    {translation("rankings.close")}
                  </button>
                </div>

                <div className={styles.fullLinksTableWrapper}>
                  <table className={styles.rankingTable}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{translation("rankings.columns.link")}</th>
                        <th>{translation("rankings.columns.clicks")}</th>
                      </tr>
                    </thead>

                    <tbody>
                      {allTrackedLinks.map((row, index) => (
                        <tr key={row.id || index}>
                          <td>
                            <span className={styles.rankingPosition}>
                              {index + 1}
                            </span>
                          </td>

                          <td>
                            <span className={styles.rankingMainText}>
                              {row.label}
                            </span>
                          </td>

                          <td>{format(row.clicks)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* Secção de gráficos de evolução diária */}
          <section
            className={`${styles.section} ${
              !visibleChartSections.trends ? styles.sectionCollapsed : ""
            }`}
          >
            <div className={styles.sectionHeader}>
              <div>
               <div className={styles.titleWithInfo}>
                <h2 className={styles.sectionTitle}>
                  {translation("trends.title")}
                </h2>

                <DescriptionInfo text={translation("trends.description")} />
              </div>
              </div>

              <button
                type="button"
                className={styles.metricGroupToggle}
                onClick={() => toggleChartSection("trends")}
              >
                {visibleChartSections.trends
                  ? translation("customization.hide")
                  : translation("customization.show")}
              </button>
            </div>

                {visibleChartSections.trends && (
                <div className={styles.trendChartGrid}>
                  <TrendChartCard
                    title={translation("trends.messagesTitle")}
                    description={translation("trends.messagesDescription")}
                    data={dailyMessagesData}
                    dataKey="messages"
                    locale={locale}
                    emptyMessage={translation("trends.empty")}
                  />

                  <TrendChartCard
                    title={translation("trends.clicksTitle")}
                    description={translation("trends.clicksDescription")}
                    data={dailyClicksData}
                    dataKey="clicks"
                    locale={locale}
                    emptyMessage={translation("trends.empty")}
                  />

                 

                  <TrendChartCard
                    title={translation("trends.automationsTitle")}
                    description={translation("trends.automationsDescription")}
                    data={dailyAutomationRunsData}
                    dataKey="processed"
                    locale={locale}
                    emptyMessage={translation("trends.empty")}
                  />
                </div>
              )}
          </section>

          {/* Resumo operacional final */}
          <section className={`${styles.section} ${styles.operationalSummary}`}>
            <h2 className={styles.sectionTitle}>
              {translation("sections.breakdownTitle")}
            </h2>

            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>
                  {translation("sections.users.title")}
                </span>

                <strong className={styles.summaryValue}>
                  {translation("sections.users.value", {
                    total: format(users.total),
                    withAssistant: format(users.withAssistant),
                  })}
                </strong>

                <p>
                  {translation("sections.users.text", {
                    email: format(users.withEmail),
                    phone: format(users.withPhone),
                    teams: format(users.withTeams),
                    whatsapp: format(users.withWhatsapp),
                  })}
                </p>
              </div>

              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>
                  {translation("sections.messages.title")}
                </span>

                <strong className={styles.summaryValue}>
                  {translation("sections.messages.value", {
                    total: format(messages.total),
                  })}
                </strong>

                <p>
                  {translation("sections.messages.text", {
                    userMessages: format(messages.userMessages),
                    assistantMessages: format(messages.assistantMessages),
                    read: format(messages.read),
                    failed: format(messages.failed),
                  })}
                </p>
              </div>

              <div
                className={`${styles.summaryItem} ${
                  safeNumber(automations.runsFailed) +
                    safeNumber(scheduledBroadcasts.failed) >
                  0
                    ? styles.summaryWarning
                    : ""
                }`}
              >
                <span className={styles.summaryLabel}>
                  {translation("sections.attention.title")}
                </span>

                <strong className={styles.summaryValue}>
                  {translation("sections.attention.value", {
                    total:
                      safeNumber(automations.runsFailed) +
                      safeNumber(scheduledBroadcasts.failed),
                  })}
                </strong>

                <p>
                  {translation("sections.attention.text", {
                    automationFailures: format(automations.runsFailed),
                    scheduledFailures: format(scheduledBroadcasts.failed),
                    rejectedTemplates: format(templates.rejected),
                  })}
                </p>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

