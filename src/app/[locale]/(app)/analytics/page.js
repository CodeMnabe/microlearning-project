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
} from "lucide-react";

  import {
  ResponsiveContainer,
  BarChart,
  Bar,
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

/* Esta função serve para calcular percentagens sem rebentar quando o total é 0.*/
function safePercent(part, total) {
  const partNumber = safeNumber(part);
  const totalNumber = safeNumber(total);

  if (totalNumber <= 0) return 0;

  return Math.round((partNumber / totalNumber) * 100);
}

function safeNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

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
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1687b8" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.chartEmpty}>Sem dados para mostrar.</div>
            )}
          </div>
        </section>
      );
    }


export default function AnalyticsPage() {
  const translation = useTranslations("Analytics");
  const locale = useLocale();

  const { user, loading: authLoading } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const { startLoading, stopLoading } = useGlobalLoader();

  const orgId = org?.id;

  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");

  const formatter = useMemo(() => {
    return new Intl.NumberFormat(locale || "pt-PT");
  }, [locale]);

  function format(value) {
    return formatter.format(safeNumber(value));
  }



  const loadMetrics = useCallback(async () => {
    if (!orgId) return;

    setError("");
    startLoading();

    try {
      const res = await fetch(`/api/analytics/overview?orgId=${orgId}`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load analytics.");
      }

      setMetrics(data);
    } catch (err) {
      console.warn("[Analytics] load error:", err);
      setError(translation("errors.load"));
    } finally {
      stopLoading();
    }
  }, [orgId, startLoading, stopLoading, translation]);

  useEffect(() => {
    if (authLoading || orgLoading || !orgId) return;

    loadMetrics();
  }, [authLoading, orgLoading, orgId, loadMetrics]);

  const health = useMemo(() => {
    if (!metrics) return null;

    const problems =
      safeNumber(metrics.assistants?.withoutOpenAiId) +
      safeNumber(metrics.templates?.rejected) +
      safeNumber(metrics.messages?.failed) +
      safeNumber(metrics.automations?.runsFailed) +
      safeNumber(metrics.scheduledBroadcasts?.failed);

    if (problems > 0) {
      return {
        tone: "danger",
        value: translation("health.needsAttention"),
        description: translation("health.errorsFound", { count: problems }),
      };
    }

    return {
      tone: "success",
      value: translation("health.ok"),
      description: translation("health.noErrors"),
    };
  }, [metrics, translation]);

  const users = metrics?.users ?? {};
  const assistants = metrics?.assistants ?? {};
  const templates = metrics?.templates ?? {};
  const messages = metrics?.messages ?? {};
  const automations = metrics?.automations ?? {};
  const scheduledBroadcasts = metrics?.scheduledBroadcasts ?? {};
  const trackedLinks = metrics?.trackedLinks ?? {};
  const pendingOutreach = metrics?.pendingOutreach ?? {};

  const assistantCoverageRate = safePercent(users.withAssistant, users.total);
  const emailCoverageRate = safePercent(users.withEmail, users.total);
  const phoneCoverageRate = safePercent(users.withPhone, users.total);
  const teamsCoverageRate = safePercent(users.withTeams, users.total);
  const whatsappCoverageRate = safePercent(users.withWhatsapp, users.total);

  const readRate = safePercent(messages.read, messages.total);
  const failedMessageRate = safePercent(messages.failed, messages.total);

  const automationFailureRate = safePercent(
    automations.runsFailed,
    automations.runsTotal
  );

  const scheduledFailureRate = safePercent(
    scheduledBroadcasts.failed,
    scheduledBroadcasts.total
  );

  const clickPerLinkRate = safePercent(
    trackedLinks.totalClicks,
    trackedLinks.totalLinks
  );

  const contactChartData = [
  {
    name: translation("charts.email"),
    value: safeNumber(users.withEmail),
  },
  {
    name: translation("charts.phone"),
    value: safeNumber(users.withPhone),
  },
  {
    name: translation("charts.teams"),
    value: safeNumber(users.withTeams),
  },
  {
    name: translation("charts.whatsapp"),
    value: safeNumber(users.withWhatsapp),
  },
];

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

const problemsChartData = [
  {
    name: translation("charts.assistants"),
    value: safeNumber(assistants.withoutOpenAiId),
  },
  {
    name: translation("charts.templates"),
    value: safeNumber(templates.rejected),
  },
  {
    name: translation("charts.messages"),
    value: safeNumber(messages.failed),
  },
  {
    name: translation("charts.automations"),
    value: safeNumber(automations.runsFailed),
  },
  {
    name: translation("charts.scheduled"),
    value: safeNumber(scheduledBroadcasts.failed),
  },
];


  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{translation("title")}</h1>
          <p className={styles.subtitle}>{translation("subtitle")}</p>
        </div>

        <button
          type="button"
          className={styles.refreshButton}
          onClick={loadMetrics}
          disabled={!orgId}
        >
          <RefreshCw size={16} />
          {translation("refresh")}
        </button>
      </header>

      {!orgId && !authLoading && !orgLoading && (
        <div className={styles.errorBox}>
          {translation("errors.noOrg")}
        </div>
      )}

      {error && <div className={styles.errorBox}>{error}</div>}

      {!metrics && !error ? (
        <div className={styles.empty}>{translation("loading")}</div>
      ) : null}

      {metrics && (
        <>
          <section className={styles.grid}>
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
              tone={safeNumber(assistants.withoutOpenAiId) > 0 ? "warning" : "default"}
            />

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
              tone={safeNumber(automations.runsFailed) > 0 ? "warning" : "default"}
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
              tone={safeNumber(scheduledBroadcasts.failed) > 0 ? "warning" : "default"}
            />

            <MetricCard
              icon={MousePointerClick}
              title={translation("cards.trackedLinks")}
              value={format(trackedLinks.totalClicks)}
              description={translation("cards.trackedLinksHelper", {
                links: format(trackedLinks.totalLinks),
              })}
            />

            <MetricCard
              icon={MessageSquare}
              title={translation("cards.pendingOutreach")}
              value={format(pendingOutreach.total)}
              description={translation("cards.pendingOutreachHelper", {
                active: format(pendingOutreach.active),
              })}
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
              icon={MousePointerClick}
              title={translation("cards.clickDensity")}
              value={`${clickPerLinkRate}%`}
              description={translation("cards.clickDensityHelper", {
                clicks: format(trackedLinks.totalClicks),
                links: format(trackedLinks.totalLinks),
              })}
            />

            {health && (
              <MetricCard
                icon={AlertTriangle}
                title={translation("cards.health")}
                value={health.value}
                description={health.description}
                tone={health.tone}
              />

            )}
            

          </section>

          <section className={styles.chartGrid}>
        <ChartCard
          title={translation("charts.contactTitle")}
          description={translation("charts.contactDescription")}
          data={contactChartData}
        />

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

        <ChartCard
          title={translation("charts.problemsTitle")}
          description={translation("charts.problemsDescription")}
          data={problemsChartData}
        />
      </section>

          <section className={styles.section}>
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

        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>
            {translation("sections.next.title")}
          </span>

          <strong className={styles.summaryValue}>
            {translation("sections.next.value")}
          </strong>

          <p>{translation("sections.next.text")}</p>
        </div>
      </div>
    </section>
        </>
      )}
    </main>
  );
}