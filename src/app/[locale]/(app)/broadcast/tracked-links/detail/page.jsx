"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import styles from "./detail.module.css";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import LoaderLink from "@/app/[locale]/(marketing)/components/TopLoader/LoaderLink";
import { useTranslations } from "next-intl";

function formatDate(value) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleString();
}

function personLine(item) {
  return item.name || item.email || item.phoneNumber || "Unknown recipient";
}

export default function TrackedLinkDetailPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { org } = useOrganization(user);
  const { stopLoading } = useGlobalLoader();
  const translations = useTranslations();

  const scheduledBroadcastId =
    searchParams.get("scheduledBroadcastId") || "null";

  const linkKey = searchParams.get("linkKey") || "";
  const destinationUrl = searchParams.get("destinationUrl") || "";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const backHref = "/broadcast/tracked-links";

  useEffect(() => {
    if (!org?.id || !linkKey || !destinationUrl) return;

    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const query = new URLSearchParams({
          orgId: String(org.id),
          scheduledBroadcastId,
          linkKey,
          destinationUrl,
        });

        const res = await fetch(`/api/tracked-links/report-detail?${query}`, {
          cache: "no-store",
        });

        const result = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            result?.error || "Failed to load tracked link detail.",
          );
        }

        if (!alive) return;
        setData(result);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Failed to load tracked link detail.");
      } finally {
        if (!alive) return;
        setLoading(false);
        stopLoading();
      }
    })();

    return () => {
      alive = false;
    };
  }, [org?.id, scheduledBroadcastId, linkKey, destinationUrl, stopLoading]);

  const summary = useMemo(() => data?.summary || null, [data]);
  const clicked = useMemo(() => data?.clicked || [], [data]);
  const notClicked = useMemo(() => data?.notClicked || [], [data]);

  return (
    <div className={styles.screen}>
      <div className={styles.topRow}>
        <LoaderLink href={backHref} className={styles.backBtn}>
          ← {translations("TrackedLinks.detail.back")}
        </LoaderLink>
      </div>

      {loading && (
        <div className={styles.emptyBox}>
          {translations("TrackedLinks.detail.loading")}
        </div>
      )}

      {!loading && error && <div className={styles.errorBox}>{error}</div>}

      {!loading && !error && summary && (
        <>
          <div className={styles.headerCard}>
            <div className={styles.headerInfo}>
              <h1 className={styles.title}>
                {summary.linkLabel ||
                  translations("TrackedLinks.detail.trackedLink")}
              </h1>

              <div className={styles.metaRow}>
                <span className={styles.metaPill}>
                  {summary.channel || "-"}
                </span>
                <span className={styles.metaPill}>
                  {translations("TrackedLinks.detail.key")}:{" "}
                  <code>{summary.linkKey || "-"}</code>
                </span>
              </div>

              <div className={styles.destinationBox}>
                <div className={styles.destinationLabel}>
                  {translations("TrackedLinks.detail.destinationUrl")}
                </div>
                <div className={styles.destinationValue}>
                  {summary.destinationUrl || "-"}
                </div>
              </div>
            </div>

            <div className={styles.cardsGrid}>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>
                  {translations("TrackedLinks.detail.recipients")}
                </div>
                <div className={styles.kpiValue}>{summary.totalRecipients}</div>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>
                  {translations("TrackedLinks.detail.clicked")}
                </div>
                <div className={styles.kpiValue}>{summary.clickedCount}</div>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>
                  {translations("TrackedLinks.detail.notClicked")}
                </div>
                <div className={styles.kpiValue}>{summary.notClickedCount}</div>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>
                  {translations("TrackedLinks.detail.totalClicks")}
                </div>
                <div className={styles.kpiValue}>{summary.totalClicks}</div>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>
                  {translations("TrackedLinks.detail.clickRate")}
                </div>
                <div className={styles.kpiValue}>{summary.clickRate}%</div>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>
                  {translations("TrackedLinks.detail.created")}
                </div>
                <div className={styles.kpiValue}>
                  {formatDate(summary.createdAt)}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              {translations("TrackedLinks.detail.clicked")}
            </h2>

            {clicked.length === 0 ? (
              <div className={styles.emptyBox}>
                {translations("TrackedLinks.detail.noClickedUsers")}
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{translations("TrackedLinks.detail.recipient")}</th>
                      <th>{translations("TrackedLinks.detail.email")}</th>
                      <th>{translations("TrackedLinks.detail.phone")}</th>
                      <th>{translations("TrackedLinks.detail.clicks")}</th>
                      <th>{translations("TrackedLinks.detail.firstClick")}</th>
                      <th>{translations("TrackedLinks.detail.lastClick")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clicked.map((item) => (
                      <tr key={item.trackedLinkId}>
                        <td className={styles.strongCell}>
                          {personLine(item)}
                        </td>
                        <td>{item.email || "-"}</td>
                        <td>{item.phoneNumber || "-"}</td>
                        <td>{item.clickCount}</td>
                        <td>{formatDate(item.firstClickAt)}</td>
                        <td>{formatDate(item.lastClickAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              {translations("TrackedLinks.detail.notClicked")}
            </div>

            {notClicked.length === 0 ? (
              <div className={styles.emptyBox}>
                {translations("TrackedLinks.detail.allClickedUsers")}
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{translations("TrackedLinks.detail.recipient")}</th>
                      <th>{translations("TrackedLinks.detail.email")}</th>
                      <th>{translations("TrackedLinks.detail.phone")}</th>
                      <th>{translations("TrackedLinks.detail.sentAt")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notClicked.map((item) => (
                      <tr key={item.trackedLinkId}>
                        <td className={styles.strongCell}>
                          {personLine(item)}
                        </td>
                        <td>{item.email || "-"}</td>
                        <td>{item.phoneNumber || "-"}</td>
                        <td>{formatDate(item.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
