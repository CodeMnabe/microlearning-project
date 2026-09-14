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

import styles from "../../tracked-links/detail/detail.module.css";
import own from "../questions.module.css";

function formatDate(value) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleString();
}

function personLine(item, fallback) {
  return item.name || item.email || item.phoneNumber || fallback;
}

/**
 * Resultados de uma pergunta: resumo, quem respondeu (com correção manual
 * do veredicto nas perguntas abertas) e quem não respondeu.
 */
export default function QuestionDetailPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const { stopLoading } = useGlobalLoader();
  const translation = useTranslations();
  const showAlert = useAlert();

  const showAlertRef = useRef(showAlert);

  useEffect(() => {
    showAlertRef.current = showAlert;
  }, [showAlert]);

  const questionId = searchParams.get("questionId") || "";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    if (orgLoading) return;

    /* Sem organização ainda: fica a carregar até o hook a resolver. */
    if (!org?.id) return;

    if (!questionId) {
      setLoading(false);
      stopLoading();
      setError(translation("Questions.detail.alerts.missingQuestion.message"));

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

        setError(translation("Questions.detail.alerts.loadFailed.message"));

        void showAlertRef.current({
          title: translation("Questions.detail.alerts.loadFailed.title"),
          message: translation("Questions.detail.alerts.loadFailed.message"),
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
  }, [org?.id, orgLoading, questionId, stopLoading, translation]);

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

        /* Os cartões de veredictos seguem a correção. */
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

  return (
    <div className={styles.screen}>
      <div className={styles.topRow}>
        <Link href="/broadcast/questions" className={styles.backBtn}>
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
          <div className={styles.headerCard}>
            <div className={styles.headerInfo}>
              <h1 className={styles.title}>{summary.body}</h1>

              <div className={styles.metaRow}>
                <span className={styles.metaPill}>
                  {translation(`Questions.kind.${summary.kind}`)}
                </span>
                <span className={styles.metaPill}>
                  {translation("Questions.detail.sentAt")}:{" "}
                  {formatDate(summary.sentAt)}
                </span>
                <span className={styles.metaPill}>
                  {translation("Questions.detail.expiresAt")}:{" "}
                  {formatDate(summary.expiresAt)}
                </span>
                {isOpen && (
                  <span className={styles.metaPill}>
                    {translation("Questions.detail.aiEvaluation")}:{" "}
                    {translation(
                      summary.aiEvaluation
                        ? "Questions.detail.aiOn"
                        : "Questions.detail.aiOff",
                    )}
                  </span>
                )}
              </div>

              <div className={styles.destinationBox}>
                <div className={styles.destinationLabel}>
                  {hasOptions
                    ? translation("Questions.detail.options")
                    : translation("Questions.detail.expectedAnswer")}
                </div>

                {hasOptions ? (
                  <ul className={own.optionList}>
                    {summary.options.map((option, index) => (
                      <li key={index} className={own.optionItem}>
                        <span>{option.label}</span>
                        {option.correct ? (
                          <span className={own.optionCorrect}>
                            {translation("Questions.detail.correctOption")}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className={styles.destinationValue}>
                    {summary.expectedAnswer || "-"}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.cardsGrid}>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>
                  {translation("Questions.detail.recipients")}
                </div>
                <div className={styles.kpiValue}>{summary.recipientCount}</div>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>
                  {translation("Questions.detail.answered")}
                </div>
                <div className={styles.kpiValue}>{summary.answeredCount}</div>
              </div>

              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>
                  {translation("Questions.detail.responseRate")}
                </div>
                <div className={styles.kpiValue}>{summary.responseRate}%</div>
              </div>

              {isQuiz ? (
                <>
                  <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>
                      {translation("Questions.detail.correct")}
                    </div>
                    <div className={styles.kpiValue}>
                      {summary.correctCount}
                    </div>
                  </div>

                  <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>
                      {translation("Questions.detail.correctRate")}
                    </div>
                    <div className={styles.kpiValue}>
                      {summary.correctRate}%
                    </div>
                  </div>
                </>
              ) : isSurvey ? (
                summary.options.map((option, index) => (
                  <div key={index} className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>{option.label}</div>
                    <div className={styles.kpiValue}>
                      {summary.optionCounts?.[index] ?? 0}
                    </div>
                  </div>
                ))
              ) : (
                VERDICTS.map((verdict) => (
                  <div key={verdict} className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>
                      {verdictLabel(verdict)}
                    </div>
                    <div className={styles.kpiValue}>
                      {summary.verdicts?.[verdict] ?? 0}
                    </div>
                  </div>
                ))
              )}

              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>
                  {translation("Questions.detail.toReview")}
                </div>
                <div className={styles.kpiValue}>
                  {summary.reviewNeededCount}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              {translation("Questions.detail.answered")}
            </div>

            {answered.length === 0 ? (
              <div className={styles.emptyBox}>
                {translation("Questions.detail.noAnswers")}
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table} data-testid="answered-table">
                  <thead>
                    <tr>
                      <th>{translation("Questions.detail.table.contact")}</th>
                      <th>{translation("Questions.detail.table.phone")}</th>
                      <th>{translation("Questions.detail.table.answer")}</th>
                      <th>
                        {isQuiz
                          ? translation("Questions.detail.table.result")
                          : isSurvey
                            ? translation("Questions.detail.table.choice")
                            : translation("Questions.detail.table.verdict")}
                      </th>
                      <th>
                        {translation("Questions.detail.table.answeredAt")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {answered.map((item) => (
                      <tr
                        key={item.answerId}
                        className={item.reviewNeeded ? own.reviewRow : ""}
                      >
                        <td className={styles.strongCell}>
                          {personLine(item, `#${item.userId}`)}
                        </td>
                        <td>{item.phoneNumber || "-"}</td>
                        <td className={own.answerCell}>
                          {item.answerText || item.optionLabel || "-"}
                          {isOpen && item.aiFeedback ? (
                            <div className={own.feedbackText}>
                              {translation("Questions.detail.table.feedback")}:{" "}
                              {item.aiFeedback}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          {isSurvey ? (
                            <span>
                              {item.optionLabel || item.answerText || "-"}
                            </span>
                          ) : isQuiz ? (
                            <span
                              className={
                                item.isCorrect ? own.resultOk : own.resultBad
                              }
                            >
                              {translation(
                                item.isCorrect
                                  ? "Questions.detail.right"
                                  : "Questions.detail.wrong",
                              )}
                            </span>
                          ) : (
                            <div className={own.verdictCell}>
                              <select
                                className={own.verdictSelect}
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
                                  {translation("Questions.detail.useAiVerdict")}
                                </option>
                                {VERDICTS.map((verdict) => (
                                  <option key={verdict} value={verdict}>
                                    {verdictLabel(verdict)}
                                  </option>
                                ))}
                              </select>
                              <span className={own.subtle}>
                                {translation(
                                  "Questions.detail.table.aiVerdict",
                                  {
                                    verdict: verdictLabel(item.verdict),
                                  },
                                )}
                              </span>
                              {item.reviewNeeded ? (
                                <span className={own.reviewBadge}>
                                  {translation("Questions.detail.reviewNeeded")}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td>{formatDate(item.answeredAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              {translation("Questions.detail.notAnswered")}
            </div>

            {notAnswered.length === 0 ? (
              <div className={styles.emptyBox}>
                {translation("Questions.detail.allAnswered")}
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
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
                        <td>{formatDate(item.sentAt)}</td>
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
