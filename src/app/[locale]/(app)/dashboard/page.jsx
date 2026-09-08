"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowUpRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FileText,
  MessageCircle,
  RefreshCw,
  Settings,
  Sparkles,
  Tags,
  ToggleRight,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
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

function MetricCard({ icon: Icon, label, value, href, helper }) {
  const content = (
    <>
      <span className={styles.cardIcon} aria-hidden="true">
        <Icon size={19} strokeWidth={2} />
      </span>
      <span className={styles.cardBody}>
        <span className={styles.cardLabel}>{label}</span>
        <strong className={styles.cardValue}>{number(value)}</strong>
        {helper ? <span className={styles.cardHelper}>{helper}</span> : null}
      </span>
      {href ? <ArrowUpRight className={styles.cardArrow} size={16} aria-hidden="true" /> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={styles.card}>
        {content}
      </Link>
    );
  }

  return <article className={styles.card}>{content}</article>;
}

function ChannelStatus({
  icon: Icon,
  label,
  configured,
  used,
  total,
  configuredText,
  usedText,
}) {
  const completion = percentage(used, total);

  return (
    <div className={styles.channelRow}>
      <span className={styles.channelIcon} aria-hidden="true">
        <Icon size={19} strokeWidth={2} />
      </span>
      <div className={styles.channelBody}>
        <div className={styles.channelHeader}>
          <span>{label}</span>
          <span>{completion}%</span>
        </div>
        <div className={styles.progressTrack} aria-hidden="true">
          <span className={styles.progressFill} style={{ width: `${completion}%` }} />
        </div>
        <div className={styles.channelMeta}>
          <span>
            {number(configured)} {configuredText}
          </span>
          <span>
            {number(used)} {usedText}
          </span>
        </div>
      </div>
    </div>
  );
}

function QuickLink({ href, icon: Icon, title, description }) {
  return (
    <Link href={href} className={styles.quickLink}>
      <span className={styles.quickLinkIcon} aria-hidden="true">
        <Icon size={17} strokeWidth={2} />
      </span>
      <span className={styles.quickLinkBody}>
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <ChevronRight size={16} aria-hidden="true" />
    </Link>
  );
}

function LoadingState() {
  return (
    <div className={styles.loadingState} aria-busy="true" aria-label="Loading">
      <div className={`${styles.skeleton} ${styles.skeletonHero}`} />
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 5 }).map((_, index) => (
          <div className={styles.skeleton} key={index} />
        ))}
      </div>
      <div className={styles.loadingColumns}>
        <div className={`${styles.skeleton} ${styles.skeletonPanel}`} />
        <div className={`${styles.skeleton} ${styles.skeletonPanel}`} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const { user, loading: authLoading } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const { stopLoading } = useGlobalLoader();
  const [overview, setOverview] = useState(null);
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
      });
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
  const organizationName = org?.name?.trim() || t("organizationFallback");

  if (authLoading || orgLoading || (loading && org?.id)) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.eyebrow}>{t("eyebrow")}</span>
            <h1>{t("title")}</h1>
            <p>{t("description")}</p>
          </div>
        </header>
        <LoadingState />
      </main>
    );
  }

  if (!org?.id) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.eyebrow}>{t("eyebrow")}</span>
            <h1>{t("title")}</h1>
            <p>{t("description")}</p>
          </div>
        </header>
        <div className={styles.errorBox}>
          <p>{t("organizationMissing")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.eyebrow}>{t("eyebrow")}</span>
          <h1>{t("title")}</h1>
          <p>{t("description")}</p>
        </div>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={loadOverview}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? styles.spin : ""} aria-hidden="true" />
          {t("refresh")}
        </button>
      </header>

      {error ? (
        <div className={styles.errorBox} role="alert">
          <p>{error}</p>
          <button type="button" onClick={loadOverview} disabled={loading}>
            <RefreshCw size={15} className={loading ? styles.spin : ""} aria-hidden="true" />
            {t("retry")}
          </button>
        </div>
      ) : null}

      <div className={styles.dashboard}>
        <section className={styles.heroCard}>
          <div className={styles.heroContent}>
            <span className={styles.heroKicker}>
              <Sparkles size={15} aria-hidden="true" />
              {t("welcome.kicker")}
            </span>
            <h2>{t("welcome.title", { name: organizationName })}</h2>
            <p>{t("welcome.description")}</p>
            <div className={styles.heroActions}>
              <Link href="/users" className={styles.primaryAction}>
                {t("welcome.primaryAction")}
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/settings" className={styles.secondaryAction}>
                <Settings size={15} aria-hidden="true" />
                {t("welcome.secondaryAction")}
              </Link>
            </div>
          </div>
          <div className={styles.heroStat}>
            <span>{t("welcome.totalUsers")}</span>
            <strong>{number(users.total)}</strong>
            <small>{t("welcome.totalUsersHint")}</small>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelEyebrow}>{t("sections.overview")}</span>
              <h2>{t("groups.users")}</h2>
              <p>{t("sections.usersDescription")}</p>
            </div>
            <Link href="/users" className={styles.panelLink}>
              {t("actions.viewUsers")}
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.metricGrid}>
            <MetricCard icon={Users} label={t("metrics.totalUsers")} value={users.total} href="/users" />
            <MetricCard
              icon={UserCheck}
              label={t("metrics.teamsConfigured")}
              value={users.teamsConfigured}
              href="/users"
            />
            <MetricCard
              icon={MessageCircle}
              label={t("metrics.whatsappConfigured")}
              value={users.whatsappConfigured}
              href="/users"
            />
            <MetricCard
              icon={ToggleRight}
              label={t("metrics.teamsUsed")}
              value={users.teamsUsed}
              href="/analytics"
            />
            <MetricCard
              icon={MessageCircle}
              label={t("metrics.whatsappUsed")}
              value={users.whatsappUsed}
              href="/analytics"
            />
          </div>
        </section>

        <div className={styles.dashboardColumns}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>{t("sections.resources")}</span>
                <h2>{t("groups.content")}</h2>
                <p>{t("sections.contentDescription")}</p>
              </div>
            </div>
            <div className={styles.metricGridTwo}>
              <MetricCard
                icon={Tags}
                label={t("metrics.tags")}
                value={content.tags}
                helper={t("metrics.tagsHelper")}
                href="/users"
              />
              <MetricCard
                icon={Bot}
                label={t("metrics.assistants")}
                value={content.assistants}
                helper={t("metrics.assistantsHelper")}
                href="/assistants"
              />
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>{t("sections.operations")}</span>
                <h2>{t("groups.automations")}</h2>
                <p>{t("sections.automationsDescription")}</p>
              </div>
              <Link href="/automations" className={styles.panelLink}>
                {t("actions.viewAutomations")}
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.metricGridThree}>
              <MetricCard
                icon={Zap}
                label={t("metrics.automationsTotal")}
                value={automations.total}
                href="/automations"
              />
              <MetricCard
                icon={ToggleRight}
                label={t("metrics.automationsActive")}
                value={automations.active}
                href="/automations"
              />
              <MetricCard
                icon={CalendarClock}
                label={t("metrics.scheduledMessages")}
                value={automations.scheduledMessages}
                href="/broadcast/scheduled"
              />
            </div>
          </section>
        </div>

        <div className={styles.dashboardColumns}>
          <section className={`${styles.panel} ${styles.channelPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>{t("sections.configuration")}</span>
                <h2>{t("channels.title")}</h2>
                <p>{t("channels.description")}</p>
              </div>
              <Link href="/settings" className={styles.panelLink}>
                {t("actions.viewSettings")}
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.channelList}>
              <ChannelStatus
                icon={ToggleRight}
                label={t("channels.teams")}
                configured={users.teamsConfigured}
                used={users.teamsUsed}
                total={users.total}
                configuredText={t("channels.configured")}
                usedText={t("channels.used")}
              />
              <ChannelStatus
                icon={MessageCircle}
                label={t("channels.whatsapp")}
                configured={users.whatsappConfigured}
                used={users.whatsappUsed}
                total={users.total}
                configuredText={t("channels.configured")}
                usedText={t("channels.used")}
              />
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>{t("sections.shortcuts")}</span>
                <h2>{t("quickActions.title")}</h2>
                <p>{t("quickActions.description")}</p>
              </div>
            </div>
            <div className={styles.quickLinks}>
              <QuickLink
                href="/users"
                icon={Users}
                title={t("quickActions.users")}
                description={t("quickActions.usersDescription")}
              />
              <QuickLink
                href="/assistants"
                icon={Bot}
                title={t("quickActions.assistants")}
                description={t("quickActions.assistantsDescription")}
              />
              <QuickLink
                href="/automations"
                icon={Zap}
                title={t("quickActions.automations")}
                description={t("quickActions.automationsDescription")}
              />
              <QuickLink
                href="/broadcast"
                icon={FileText}
                title={t("quickActions.broadcast")}
                description={t("quickActions.broadcastDescription")}
              />
            </div>
            <p className={styles.panelFooterNote}>
              <CheckCircle2 size={14} aria-hidden="true" />
              {t("quickActions.footer")}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
