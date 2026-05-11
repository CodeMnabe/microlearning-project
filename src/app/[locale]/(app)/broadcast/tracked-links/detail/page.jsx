"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import LoaderLink from "@/app/[locale]/(marketing)/components/TopLoader/LoaderLink";
import styles from "./detail.module.css";
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
  const translation = useTranslations("TrackedLinks.detail");

  const sendGroupId = searchParams.get("sendGroupId") || "";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const backHref = "/broadcast/tracked-links";

  useEffect(() => {
    if (!org?.id || !sendGroupId) return;

    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const query = new URLSearchParams({
          orgId: String(org.id),
          sendGroupId,
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
  }, [org?.id, sendGroupId, stopLoading]);

  const summary = useMemo(() => data?.summary || null, [data]);
  const clicked = useMemo(() => data?.clicked || [], [data]);
  const notClicked = useMemo(() => data?.notClicked || [], [data]);

  return (
    <div className={styles.screen}>
      <div className={styles.topRow}>
        <LoaderLink href={backHref} className={styles.backBtn}>
          ← {translation("back")}
        </LoaderLink>
      </div>

      {loading && (
        <div className={styles.emptyBox}>{translation("loading")}</div>
      )}

      {!loading && error && <div className={styles.errorBox}>{error}</div>}

      {!loading && !error && summary && (
        <>
          <div className={styles.headerCard}>
            <div className={styles.headerInfo}>
              <h1 className={styles.title}>
                {summary.linkLabel || "Tracked Link"}
              </h1>

              <div className={styles.metaRow}>
                <span className={styles.metaPill}>
                  {summary.channel || "-"}
                </span>
                <span className={styles.metaPill}>
                  {translation("key")}: <code>{summary.linkKey || "-"}</code>
                </span>
              </div>

              <div className={styles.destinationBox}>
                <div className={styles.destinationLabel}>
                  {translation("destinationUrl")}
                </div>
                <div className={styles.destinationValue}>
                  {summary.destinationUrl || "-"}
                </div>
              </div>
            </div>

            <div className={styles.cardsGrid}>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>
                  {translation("recipient")}
                </div>
                <div className={styles.kpiValue}>{summary.totalRecipients}</div>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>{translation("clicked")}</div>
                <div className={styles.kpiValue}>{summary.clickedCount}</div>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>
                  {translation("notClicked")}
                </div>
                <div className={styles.kpiValue}>{summary.notClickedCount}</div>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>
                  {translation("totalClicks")}
                </div>
                <div className={styles.kpiValue}>{summary.totalClicks}</div>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>
                  {translation("clickRate")}
                </div>
                <div className={styles.kpiValue}>{summary.clickRate}%</div>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>{translation("created")}</div>
                <div className={styles.kpiValue}>
                  {formatDate(summary.createdAt)}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>{translation("clicked")}</div>

            {clicked.length === 0 ? (
              <div className={styles.emptyBox}>
                {translation("noClickedUsers")}
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{translation("recipient")}</th>
                      <th>{translation("email")}</th>
                      <th>{translation("phone")}</th>
                      <th>{translation("clicks")}</th>
                      <th>{translation("firstClick")}</th>
                      <th>{translation("lastClick")}</th>
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
              {translation("notClicked")}
            </div>

            {notClicked.length === 0 ? (
              <div className={styles.emptyBox}>
                {translation("allClickedUsers")}
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{translation("recipient")}</th>
                      <th>{translation("email")}</th>
                      <th>{translation("phone")}</th>
                      <th>{translation("sentAt")}</th>
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
