"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { useTranslations } from "next-intl";
import styles from "./tracked-links.module.css";

function formatDate(value) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleDateString();
}

function getRateClass(rate) {
  const n = Number(rate || 0);
  if (n >= 70) return styles.rateGood;
  if (n <= 20) return styles.rateBad;
  return styles.rateNeutral;
}

export default function TrackedLinksPage() {
  const { user } = useAuth();
  const { org } = useOrganization(user);
  const { stopLoading } = useGlobalLoader();
  const translation = useTranslations();

  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!org?.id) return;

    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/tracked-links/reports?orgId=${org.id}`, {
          cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load tracked links.");
        }

        if (!alive) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Failed to load tracked links.");
      } finally {
        if (!alive) return;
        setLoading(false);
        stopLoading();
      }
    })();

    return () => {
      alive = false;
    };
  }, [org?.id, stopLoading]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;

    return items.filter((item) => {
      const haystack = [
        item.linkLabel,
        item.linkKey,
        item.destinationUrl,
        item.channel,
        item.sourceType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [items, q]);

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{translation("TrackedLinks.title")}</h1>
          <p className={styles.subtitle}>
            {translation("TrackedLinks.subtitle")}
          </p>
        </div>

        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>
              {translation("TrackedLinks.totalLinks")}
            </div>
            <div className={styles.statValue}>{items.length}</div>
          </div>
        </div>
      </div>

      <div className={styles.toolbarRow}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <Search size={18} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={translation("TrackedLinks.search")}
            className={styles.searchInput}
          />
        </div>
      </div>

      {loading && (
        <div className={styles.emptyBox}>
          {translation("TrackedLinks.loading")}
        </div>
      )}

      {!loading && error && <div className={styles.errorBox}>{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className={styles.emptyBox}>
          {translation("TrackedLinks.noLinks")}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className={styles.tableCard}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{translation("TrackedLinks.table.label")}</th>
                  <th>{translation("TrackedLinks.table.key")}</th>
                  <th>{translation("TrackedLinks.table.channel")}</th>
                  <th>{translation("TrackedLinks.table.destination")}</th>
                  <th>{translation("TrackedLinks.table.recipients")}</th>
                  <th>{translation("TrackedLinks.table.clicked")}</th>
                  <th>{translation("TrackedLinks.table.totalClicks")}</th>
                  <th>{translation("TrackedLinks.table.clickRate")}</th>
                  <th>{translation("TrackedLinks.table.created")}</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((item, index) => {
                  const href =
                    `/broadcast/tracked-links/detail?` +
                    new URLSearchParams({
                      scheduledBroadcastId: item.scheduledBroadcastId ?? "null",
                      linkKey: item.linkKey || "",
                      destinationUrl: item.destinationUrl || "",
                    }).toString();

                  return (
                    <tr
                      key={
                        item.groupKey ||
                        [
                          item.channel ?? "",
                          item.scheduledBroadcastId ?? "manual",
                          item.linkKey ?? "",
                          item.destinationUrl ?? "",
                          item.linkLabel ?? "",
                          item.sourceType ?? "",
                          item.createdAt ?? "",
                          index,
                        ].join("|")
                      }
                    >
                      <td>
                        <div className={styles.mainText}>
                          {item.linkLabel || "-"}
                        </div>
                      </td>

                      <td>
                        <span className={styles.code}>
                          {item.linkKey || "-"}
                        </span>
                      </td>

                      <td>
                        <span className={styles.channelBadge}>
                          {item.channel || "-"}
                        </span>
                      </td>

                      <td>
                        <div
                          className={styles.urlCell}
                          title={item.destinationUrl || "-"}
                        >
                          {item.destinationUrl || "-"}
                        </div>
                      </td>

                      <td className={styles.numberCell}>
                        {item.recipientCount}
                      </td>
                      <td className={styles.numberCell}>{item.clickedCount}</td>
                      <td className={styles.numberCell}>{item.totalClicks}</td>

                      <td className={getRateClass(item.clickRate)}>
                        {item.clickRate}%
                      </td>

                      <td>{formatDate(item.createdAt)}</td>

                      <td>
                        <Link href={href} className={styles.viewBtn}>
                          {translation("TrackedLinks.view")}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
