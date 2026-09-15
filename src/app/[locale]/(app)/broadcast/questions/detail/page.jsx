"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { useAlert } from "@/app/components/Alert/AlertProvider";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { VERDICTS } from "@/lib/services/questions/questionReports";

import styles from "../questions.module.css";

function formatDate(value) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function percentOf(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function personLine(item, fallback) {
  return item.name || item.email || item.phoneNumber || fallback;
}

/**
 * Resultados de uma pergunta: resumo, distribuição das respostas, quem
 * respondeu (com correção manual do veredicto nas perguntas abertas) e
 * quem não respondeu.
 */
export default function QuestionDetailPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const { stopLoading } = useGlobalLoader();
  const translation = useTranslations();
  const showAlert = useAlert();

  /* Refs para o efeito de carregamento não depender destas funções. */
  const showAlertRef = useRef(showAlert);
  const translationRef = useRef(translation);

  useEffect(() => {
    showAlertRef.current = showAlert;
    translationRef.current = translation;
  }, [showAlert, translation]);

  const questionId = searchParams.get("questionId") || "";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    if (orgLoading) return;

    /* Sem organização ainda: fica a carregar até o hook a resolver. */
    if (!org?.id) return;

    const t = translationRef.current;

    if (!questionId) {
      setLoading(false);
      stopLoading();
      setError(t("Questions.detail.alerts.missingQuestion.message"));

      return;
    }

    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const query = new URLSearchParams({
          orgId: String(org.id),
          questionId,
        });

        const res = await fetch(`/api/questions/report-detail?${query}`, {
          cache: "no-store",
        });

        const result = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(result?.error || "Failed to load question detail.");
        }

        if (!alive) return;

        setData(result);
      } catch {
        if (!alive) return;

        setError(t("Questions.detail.alerts.loadFailed.message"));

        void showAlertRef.current({
          title: t("Questions.detail.alerts.loadFailed.title"),
          message: t("Questions.detail.alerts.loadFailed.message"),
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
  }, [org?.id, orgLoading, questionId, stopLoading]);

  const summary = useMemo(() => data?.summary || null, [data]);
  const answered = useMemo(() => data?.answered || [], [data]);
  const notAnswered = useMemo(() => data?.notAnswered || [], [data]);
  const isQuiz = summary?.kind === "quiz";
  const isSurvey = summary?.kind === "survey";
  const isOpen = summary?.kind === "open";
  const hasOptions = isQuiz || isSurvey;

  /*
   * Corrige o veredicto de uma resposta aberta. Vazio volta ao veredicto
   * da IA. Corrigir tira a resposta da lista de revisão.
   */
  async function changeVerdict(answer, value) {
    const adminVerdict = value || null;

    setSavingId(answer.answerId);

    try {
      const res = await fetch(`/api/questions/answers/${answer.answerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, adminVerdict }),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(result?.error || "Failed to update verdict.");
      }

      setData((current) => {
        if (!current) return current;

        const nextAnswered = current.answered.map((row) =>
          row.answerId === answer.answerId
            ? {
                ...row,
                adminVerdict,
                effectiveVerdict: adminVerdict || row.verdict || null,
                reviewNeeded: false,
              }
            : row,
        );

        /* A distribuição de veredictos segue a correção. */
        const verdicts = {
          completa: 0,
          parcial: 0,
          incompleta: 0,
          semVeredicto: 0,
        };
        for (const row of nextAnswered) {
          if (VERDICTS.includes(row.effectiveVerdict))
            verdicts[row.effectiveVerdict] += 1;
          else verdicts.semVeredicto += 1;
        }

        return {
          ...current,
          answered: nextAnswered,
          summary: {
            ...current.summary,
            verdicts,
            reviewNeededCount: nextAnswered.filter((row) => row.reviewNeeded)
              .length,
          },
        };
      });
    } catch {
      void showAlertRef.current({
        title: translation("Questions.detail.alerts.updateFailed.title"),
        message: translation("Questions.detail.alerts.updateFailed.message"),
        tone: "danger",
      });
    } finally {
      setSavingId(null);
    }
  }

  function verdictLabel(verdict) {
    return translation(`Questions.detail.verdicts.${verdict || "none"}`);
  }

  /*
   * Linhas da distribuição: opções (quiz e sondagem) ou veredictos
   * (pergunta aberta), com contagem e percentagem das respostas.
   */
  function buildDistribution() {
    if (!summary) return [];

    if (hasOptions) {
      return (summary.options || []).map((option, index) => ({
        key: `option-${index}`,
        label: option.label,
        correct: isQuiz && Boolean(option.correct),
        count: summary.optionCounts?.[index] ?? 0,
      }));
    }

    const v = summary.verdicts || {};
    return [...VERDICTS, "semVeredicto"].map((verdict) => ({
      key: verdict,
      label: verdictLabel(verdict === "semVeredicto" ? null : verdict),
      correct: false,
      count: v[verdict] ?? 0,
    }));
  }

  const distribution = buildDistribution();

  const metaParts = summary
    ? [
        translation(`Questions.kind.${summary.kind}`),
        `${translation("Questions.detail.sentAt")}: ${formatDate(summary.sentAt)}`,
        `${translation("Questions.detail.expiresAt")}: ${formatDate(summary.expiresAt)}`,
        ...(isOpen
          ? [
              `${translation("Questions.detail.aiEvaluation")}: ${translation(
                summary.aiEvaluation
                  ? "Questions.detail.aiOn"
                  : "Questions.detail.aiOff",
              )}`,
            ]
          : []),
      ]
    : [];

  return (
    <div className={styles.screen}>
      <div>
        <Link href="/broadcast/questions" className={styles.backLink}>
          ← {translation("Questions.detail.back")}
        </Link>
      </div>

      {loading && (
        <div className={styles.emptyBox}>
          {translation("Questions.detail.loading")}
        </div>
      )}

      {!loading && error && <div className={styles.errorBox}>{error}</div>}

      {!loading && !error && summary && (
        <>
          <div className={styles.detailPanel}>
            <h1 className={styles.detailTitle}>{summary.body}</h1>
            <p className={styles.detailMeta}>{metaParts.join(" · ")}</p>

            <dl className={styles.statRow} data-testid="question-stats">
              <div className={styles.stat}>
                <dt>{translation("Questions.detail.recipients")}</dt>
                <dd>{summary.recipientCount}</dd>
              </div>
              <div className={styles.stat}>
                <dt>{translation("Questions.detail.answered")}</dt>
                <dd>{summary.answeredCount}</dd>
              </div>
              <div className={styles.stat}>
                <dt>{translation("Questions.detail.responseRate")}</dt>
                <dd>{summary.responseRate}%</dd>
              </div>
              {isQuiz ? (
                <div className={styles.stat}>
                  <dt>{translation("Questions.detail.correctRate")}</dt>
                  <dd>
                    {summary.correctRate}%
                    <span className={styles.statNote}>
                      {" "}
                      {translation("Questions.detail.correctOf", {
                        correct: summary.correctCount,
                        answered: summary.answeredCount,
                      })}
                    </span>
                  </dd>
                </div>
              ) : null}
              {isOpen ? (
                <div className={styles.stat}>
                  <dt>{translation("Questions.detail.toReview")}</dt>
                  <dd
                    className={
                      summary.reviewNeededCount > 0 ? styles.reviewCount : ""
                    }
                  >
                    {summary.reviewNeededCount}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className={styles.detailBlocks}>
              {isOpen ? (
                <div className={styles.detailBlock}>
                  <div className={styles.blockLabel}>
                    {translation("Questions.detail.expectedAnswer")}
                  </div>
                  <div className={styles.expectedAnswer}>
                    {summary.expectedAnswer || "-"}
                  </div>
                </div>
              ) : null}

              <div className={styles.detailBlock}>
                <div className={styles.blockLabel}>
                  {translation(
                    hasOptions
                      ? "Questions.detail.options"
                      : "Questions.detail.verdictsTitle",
                  )}
                </div>
                <table
                  className={styles.distribution}
                  data-testid="question-distribution"
                >
                  <tbody>
                    {distribution.map((row) => (
                      <tr key={row.key}>
                        <td className={styles.distributionLabel}>
                          {row.label}
                          {row.correct ? (
                            <span className={styles.correctTag}>
                              {translation("Questions.detail.correctOption")}
                            </span>
                          ) : null}
                        </td>
                        <td className={styles.numeric}>{row.count}</td>
                        <td className={`${styles.numeric} ${styles.muted}`}>
                          {percentOf(row.count, summary.answeredCount)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              {translation("Questions.detail.answeredCount", {
                count: answered.length,
              })}
            </h2>

            {answered.length === 0 ? (
              <div className={styles.emptyBox}>
                {translation("Questions.detail.noAnswers")}
              </div>
            ) : (
              <div className={styles.tableCard}>
                <div className={styles.tableWrap}>
                  <table
                    className={styles.detailTable}
                    data-testid="answered-table"
                  >
                    <thead>
                      <tr>
                        <th>{translation("Questions.detail.table.contact")}</th>
                        <th>{translation("Questions.detail.table.phone")}</th>
                        <th>{translation("Questions.detail.table.answer")}</th>
                        {isQuiz ? (
                          <th>{translation("Questions.detail.table.result")}</th>
                        ) : null}
                        {isOpen ? (
                          <th>
                            {translation("Questions.detail.table.verdict")}
                          </th>
                        ) : null}
                        <th>
                          {translation("Questions.detail.table.answeredAt")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {answered.map((item) => (
                        <tr key={item.answerId}>
                          <td className={styles.strongCell}>
                            {personLine(item, `#${item.userId}`)}
                          </td>
                          <td>{item.phoneNumber || "-"}</td>
                          <td className={styles.answerCell}>
                            {item.answerText || item.optionLabel || "-"}
                            {isOpen && item.aiFeedback ? (
                              <div className={styles.feedbackText}>
                                {translation("Questions.detail.table.feedback")}
                                : {item.aiFeedback}
                              </div>
                            ) : null}
                          </td>
                          {isQuiz ? (
                            <td
                              className={
                                item.isCorrect
                                  ? styles.resultRight
                                  : styles.resultWrong
                              }
                            >
                              {translation(
                                item.isCorrect
                                  ? "Questions.detail.right"
                                  : "Questions.detail.wrong",
                              )}
                            </td>
                          ) : null}
                          {isOpen ? (
                            <td>
                              <div className={styles.verdictCell}>
                                <select
                                  className={styles.verdictSelect}
                                  aria-label={translation(
                                    "Questions.detail.table.verdict",
                                  )}
                                  value={item.adminVerdict || ""}
                                  disabled={savingId === item.answerId}
                                  onChange={(e) =>
                                    changeVerdict(item, e.target.value)
                                  }
                                >
                                  <option value="">
                                    {translation(
                                      "Questions.detail.useAiVerdict",
                                    )}
                                  </option>
                                  {VERDICTS.map((verdict) => (
                                    <option key={verdict} value={verdict}>
                                      {verdictLabel(verdict)}
                                    </option>
                                  ))}
                                </select>
                                <span className={styles.subtle}>
                                  {translation(
                                    "Questions.detail.table.aiVerdict",
                                    { verdict: verdictLabel(item.verdict) },
                                  )}
                                  {item.reviewNeeded ? (
                                    <>
                                      {" · "}
                                      <span className={styles.reviewCount}>
                                        {translation(
                                          "Questions.detail.reviewNeeded",
                                        )}
                                      </span>
                                    </>
                                  ) : null}
                                </span>
                              </div>
                            </td>
                          ) : null}
                          <td className={styles.nowrap}>
                            {formatDate(item.answeredAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              {translation("Questions.detail.notAnsweredCount", {
                count: notAnswered.length,
              })}
            </h2>

            {notAnswered.length === 0 ? (
              <div className={styles.emptyBox}>
                {translation("Questions.detail.allAnswered")}
              </div>
            ) : (
              <div className={styles.tableCard}>
                <div className={styles.tableWrap}>
                  <table className={styles.detailTable}>
                    <thead>
                      <tr>
                        <th>{translation("Questions.detail.table.contact")}</th>
                        <th>{translation("Questions.detail.table.phone")}</th>
                        <th>{translation("Questions.detail.table.sentAt")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notAnswered.map((item) => (
                        <tr key={item.userId}>
                          <td className={styles.strongCell}>
                            {personLine(item, `#${item.userId}`)}
                          </td>
                          <td>{item.phoneNumber || "-"}</td>
                          <td className={styles.nowrap}>
                            {formatDate(item.sentAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
