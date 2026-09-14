"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAlert } from "@/app/components/Alert/AlertProvider";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";

import styles from "../tracked-links/tracked-links.module.css";
import own from "./questions.module.css";

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

/**
 * Lista das perguntas enviadas (quiz e pergunta aberta) com os totais de
 * respostas. Segue a estrutura da página de links rastreados.
 */
export default function QuestionsPage() {
  const { user } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const { stopLoading } = useGlobalLoader();
  const translation = useTranslations();
  const showAlert = useAlert();

  const showAlertRef = useRef(showAlert);

  useEffect(() => {
    showAlertRef.current = showAlert;
  }, [showAlert]);

  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (orgLoading) return;

    /* Sem organização ainda: fica a carregar até o hook a resolver. */
    if (!org?.id) return;

    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/questions/reports?orgId=${org.id}`, {
          cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load questions.");
        }

        if (!alive) return;

        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!alive) return;

        setError(translation("Questions.alerts.loadFailed.message"));

        void showAlertRef.current({
          title: translation("Questions.alerts.loadFailed.title"),
          message: translation("Questions.alerts.loadFailed.message"),
          tone: "danger",
        });
      } finally {
        if (!alive) return;

        setLoading(false);
        stopLoading();
      }
    })();

    return () => {
      alive = false;
    };
  }, [org?.id, orgLoading, stopLoading, translation]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;

    return items.filter((item) =>
      String(item.body || "")
        .toLowerCase()
        .includes(term),
    );
  }, [items, q]);

  const toReviewTotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.reviewNeededCount || 0), 0),
    [items],
  );

  function resultText(item) {
    if (item.kind === "quiz") {
      if (!item.answeredCount) return "-";
      return translation("Questions.correctRate", { rate: item.correctRate });
    }

    const v = item.verdicts || {};
    return translation("Questions.verdictSummary", {
      completa: v.completa || 0,
      parcial: v.parcial || 0,
      incompleta: v.incompleta || 0,
    });
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{translation("Questions.title")}</h1>
          <p className={styles.subtitle}>{translation("Questions.subtitle")}</p>
        </div>

        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>
              {translation("Questions.totalQuestions")}
            </div>
            <div className={styles.statValue}>{items.length}</div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statLabel}>
              {translation("Questions.toReview")}
            </div>
            <div className={styles.statValue}>{toReviewTotal}</div>
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
            placeholder={translation("Questions.search")}
            className={styles.searchInput}
          />
        </div>
      </div>

      {loading && (
        <div className={styles.emptyBox}>
          {translation("Questions.loading")}
        </div>
      )}

      {!loading && error && <div className={styles.errorBox}>{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className={styles.emptyBox}>
          {translation("Questions.noQuestions")}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className={styles.tableCard}>
          <div className={styles.tableWrap}>
            <table className={styles.table} data-testid="questions-table">
              <thead>
                <tr>
                  <th>{translation("Questions.table.question")}</th>
                  <th>{translation("Questions.table.kind")}</th>
                  <th>{translation("Questions.table.recipients")}</th>
                  <th>{translation("Questions.table.answered")}</th>
                  <th>{translation("Questions.table.responseRate")}</th>
                  <th>{translation("Questions.table.result")}</th>
                  <th>{translation("Questions.table.toReview")}</th>
                  <th>{translation("Questions.table.sent")}</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((item) => {
                  const href =
                    `/broadcast/questions/detail?` +
                    new URLSearchParams({ questionId: String(item.id) });

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className={own.questionCell} title={item.body}>
                          {item.body}
                        </div>
                      </td>

                      <td>
                        <span className={styles.channelBadge}>
                          {translation(`Questions.kind.${item.kind}`)}
                        </span>
                      </td>

                      <td className={styles.numberCell}>
                        {item.recipientCount}
                      </td>

                      <td className={styles.numberCell}>
                        {item.answeredCount}
                      </td>

                      <td className={getRateClass(item.responseRate)}>
                        {item.responseRate}%
                      </td>

                      <td>{resultText(item)}</td>

                      <td
                        className={
                          item.reviewNeededCount > 0
                            ? own.reviewCount
                            : own.reviewZero
                        }
                      >
                        {item.reviewNeededCount}
                      </td>

                      <td>{formatDate(item.sentAt)}</td>

                      <td>
                        <Link href={href} className={styles.viewBtn}>
                          {translation("Questions.view")}
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
