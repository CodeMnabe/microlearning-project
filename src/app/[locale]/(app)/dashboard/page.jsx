"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useAuth } from "@/app/AuthContext.jsx";
import useOrganization from "@/app/hooks/useOrganization";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import styles from "./dashboard.module.css";

const EMPTY_OVERVIEW = {
  users: {
    total: 0,
    teamsConfigured: 0,
    whatsappConfigured: 0,
    teamsUsed: 0,
    whatsappUsed: 0,
  },
  content: {
    tags: 0,
    assistants: 0,
  },
  automations: {
    total: 0,
    active: 0,
    scheduledMessages: 0,
  },
  activity: {
    days: 14,
    total: 0,
    series: [],
  },
  upcoming: [],
};

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentage(value, total) {
  const safeTotal = number(total);
  if (!safeTotal) return 0;
  return Math.min(100, Math.round((number(value) / safeTotal) * 100));
}

function Stat({ label, value, meta, href, percent }) {
  const body = (
    <>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statBody}>
        <span className={styles.statValue}>{number(value)}</span>
        {typeof percent === "number" ? (
          <span className={styles.statBar} aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </span>
        ) : null}
        {meta ? <span className={styles.statMeta}>{meta}</span> : null}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={styles.stat}>
        {body}
      </Link>
    );
  }

  return <div className={styles.stat}>{body}</div>;
}

function Section({ title, description, linkHref, linkLabel, children }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div className={styles.sectionCopy}>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {linkHref ? (
          <Link href={linkHref} className={styles.sectionLink}>
            {linkLabel}
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function ActivityChart({ series, t, locale }) {
  const max = Math.max(1, ...series.map((day) => day.teams + day.whatsapp));
  const dayFormatter = new Intl.DateTimeFormat(locale, { day: "numeric" });
  const fullFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div className={styles.chart} role="img" aria-label={t("activity.title")}>
      <div className={styles.chartBars}>
        {series.map((day) => {
          const date = new Date(`${day.date}T00:00:00Z`);
          const total = day.teams + day.whatsapp;
          return (
            <div
              key={day.date}
              className={styles.chartColumn}
              title={t("activity.dayTooltip", {
                date: fullFormatter.format(date),
                teams: day.teams,
                whatsapp: day.whatsapp,
              })}
            >
              <div className={styles.chartStack}>
                {total ? (
                  <>
                    <span
                      className={styles.chartTeams}
                      style={{ height: `${(day.teams / max) * 100}%` }}
                    />
                    <span
                      className={styles.chartWhatsapp}
                      style={{ height: `${(day.whatsapp / max) * 100}%` }}
                    />
                  </>
                ) : (
                  <span className={styles.chartEmptyTick} />
                )}
              </div>
              <span className={styles.chartLabel}>{dayFormatter.format(date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UpcomingList({ items, t, locale }) {
  if (!items.length) {
    return <p className={styles.emptyState}>{t("upcoming.empty")}</p>;
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <ul className={styles.upcomingList}>
      {items.map((item) => {
        const date = item.scheduledFor ? new Date(item.scheduledFor) : null;
        const channelLabel =
          item.channel === "teams" || item.channel === "whatsapp"
            ? t(`channels.${item.channel}`)
            : item.channel;
        return (
          <li key={item.id}>
            <Link href="/broadcast/scheduled" className={styles.upcomingItem}>
              <span className={styles.upcomingWhen}>
                {date && !Number.isNaN(date.getTime()) ? formatter.format(date) : "—"}
              </span>
              <span className={styles.upcomingBody}>
                <span className={styles.upcomingPreview}>
                  {item.preview || t("upcoming.noPreview")}
                </span>
                <span className={styles.upcomingMeta}>
                  <span className={styles.channelTag} data-channel={item.channel}>
                    {channelLabel}
                  </span>
                  {t("upcoming.recipients", { count: number(item.recipients) })}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function PageHeader({ t, children }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerCopy}>
        <h1>{t("title")}</h1>
        <p>{t("description")}</p>
      </div>
      {children}
    </header>
  );
}

function LoadingState() {
  return (
    <div className={styles.loadingState} aria-busy="true" aria-label="Loading">
      <div className={`${styles.skeleton} ${styles.skeletonWide}`} />
      <div className={styles.loadingColumns}>
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
      </div>
      <div className={styles.loadingColumns}>
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const { user, loading: authLoading } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const { stopLoading } = useGlobalLoader();
  const [overview, setOverview] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    if (authLoading || orgLoading || !org?.id) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/dashboard/overview?orgId=${org.id}`);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load dashboard overview.");
      }

      setOverview({
        users: { ...EMPTY_OVERVIEW.users, ...(data?.users || {}) },
        content: { ...EMPTY_OVERVIEW.content, ...(data?.content || {}) },
        automations: { ...EMPTY_OVERVIEW.automations, ...(data?.automations || {}) },
        activity: {
          ...EMPTY_OVERVIEW.activity,
          ...(data?.activity || {}),
          series: Array.isArray(data?.activity?.series) ? data.activity.series : [],
        },
        upcoming: Array.isArray(data?.upcoming) ? data.upcoming : [],
      });
      setUpdatedAt(new Date());
    } catch (loadError) {
      console.error("[Dashboard] overview load error:", loadError);
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [authLoading, orgLoading, org?.id, t]);

  useEffect(() => {
    stopLoading();
  }, [stopLoading]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const users = overview?.users || EMPTY_OVERVIEW.users;
  const content = overview?.content || EMPTY_OVERVIEW.content;
  const automations = overview?.automations || EMPTY_OVERVIEW.automations;
  const activity = overview?.activity || EMPTY_OVERVIEW.activity;
  const upcoming = overview?.upcoming || EMPTY_OVERVIEW.upcoming;

  if (authLoading || orgLoading || (loading && org?.id && !overview)) {
    return (
      <main className={styles.page}>
        <PageHeader t={t} />
        <LoadingState />
      </main>
    );
  }

  if (!org?.id) {
    return (
      <main className={styles.page}>
        <PageHeader t={t} />
        <div className={styles.errorBox}>
          <p>{t("organizationMissing")}</p>
        </div>
      </main>
    );
  }

  const shareOf = (value) => percentage(value, users.total);
  const shareOfUsers = (value) => t("meta.shareOfUsers", { percent: shareOf(value) });

  const updatedLabel = updatedAt
    ? t("updatedAt", {
        time: updatedAt.toLocaleTimeString(locale, {
          hour: "2-digit",
          minute: "2-digit",
        }),
      })
    : null;

  return (
    <main className={styles.page}>
      <PageHeader t={t}>
        <div className={styles.headerActions}>
          {updatedLabel ? <span className={styles.updatedAt}>{updatedLabel}</span> : null}
          <button
            type="button"
            className={styles.refreshButton}
            onClick={loadOverview}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? styles.spin : ""} aria-hidden="true" />
            {t("refresh")}
          </button>
        </div>
      </PageHeader>

      {error ? (
        <div className={styles.errorBox} role="alert">
          <p>{error}</p>
          <button type="button" onClick={loadOverview} disabled={loading}>
            {t("retry")}
          </button>
        </div>
      ) : null}

      <div className={styles.content}>
      <Section
        title={t("groups.users")}
        description={t("sections.usersDescription")}
        linkHref="/users"
        linkLabel={t("actions.viewUsers")}
      >
        <div className={`${styles.stats} ${styles.statsFive}`}>
          <Stat
            label={t("metrics.totalUsers")}
            value={users.total}
            meta={t("meta.inOrganization")}
            href="/users"
          />
          <Stat
            label={t("metrics.teamsConfigured")}
            value={users.teamsConfigured}
            meta={shareOfUsers(users.teamsConfigured)}
            percent={shareOf(users.teamsConfigured)}
            href="/users"
          />
          <Stat
            label={t("metrics.whatsappConfigured")}
            value={users.whatsappConfigured}
            meta={shareOfUsers(users.whatsappConfigured)}
            percent={shareOf(users.whatsappConfigured)}
            href="/users"
          />
          <Stat
            label={t("metrics.teamsUsed")}
            value={users.teamsUsed}
            meta={shareOfUsers(users.teamsUsed)}
            percent={shareOf(users.teamsUsed)}
            href="/analytics"
          />
          <Stat
            label={t("metrics.whatsappUsed")}
            value={users.whatsappUsed}
            meta={shareOfUsers(users.whatsappUsed)}
            percent={shareOf(users.whatsappUsed)}
            href="/analytics"
          />
        </div>
      </Section>

      <div className={styles.columns}>
        <Section
          title={t("groups.content")}
          description={t("sections.contentDescription")}
          linkHref="/assistants"
          linkLabel={t("actions.viewAssistants")}
        >
          <div className={`${styles.stats} ${styles.statsTwo}`}>
            <Stat
              label={t("metrics.tags")}
              value={content.tags}
              meta={t("meta.tags")}
              href="/users"
            />
            <Stat
              label={t("metrics.assistants")}
              value={content.assistants}
              meta={t("meta.assistants")}
              href="/assistants"
            />
          </div>
        </Section>

        <Section
          title={t("groups.automations")}
          description={t("sections.automationsDescription")}
          linkHref="/automations"
          linkLabel={t("actions.viewAutomations")}
        >
          <div className={`${styles.stats} ${styles.statsThree}`}>
            <Stat
              label={t("metrics.automationsTotal")}
              value={automations.total}
              meta={t("meta.automationsTotal")}
              href="/automations"
            />
            <Stat
              label={t("metrics.automationsActive")}
              value={automations.active}
              meta={t("meta.automationsActive", { total: number(automations.total) })}
              href="/automations"
            />
            <Stat
              label={t("metrics.scheduledMessages")}
              value={automations.scheduledMessages}
              meta={t("meta.scheduledMessages")}
              href="/broadcast/scheduled"
            />
          </div>
        </Section>
      </div>

      <div className={styles.columnsWide}>
        <Section
          title={t("activity.title")}
          description={t("activity.description", { days: number(activity.days) })}
          linkHref="/analytics"
          linkLabel={t("actions.viewAnalytics")}
        >
          <div className={styles.chartPanel}>
            <div className={styles.chartSummary}>
              <strong>{t("activity.total", { count: number(activity.total) })}</strong>
              <span className={styles.legend}>
                <span>
                  <i className={styles.legendTeams} />
                  {t("activity.teams")}
                </span>
                <span>
                  <i className={styles.legendWhatsapp} />
                  {t("activity.whatsapp")}
                </span>
              </span>
            </div>
            {activity.series.length ? (
              <ActivityChart series={activity.series} t={t} locale={locale} />
            ) : (
              <p className={styles.emptyState}>{t("activity.empty")}</p>
            )}
          </div>
        </Section>

        <Section
          title={t("upcoming.title")}
          description={t("upcoming.description")}
          linkHref="/broadcast/scheduled"
          linkLabel={t("actions.viewScheduled")}
        >
          <UpcomingList items={upcoming} t={t} locale={locale} />
        </Section>
      </div>
      </div>
    </main>
  );
}
