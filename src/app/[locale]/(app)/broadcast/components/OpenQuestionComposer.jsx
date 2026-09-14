"use client";

import { useEffect, useRef } from "react";
import WhatsAppPhone, {
  WhatsAppBubble,
} from "@/app/components/WhatsAppPhone/WhatsAppPhone";
import phoneStyles from "@/app/components/WhatsAppPhone/whatsAppPhone.module.css";
import {
  QUESTION_BODY_MAX_LENGTH,
  QUESTION_FEEDBACK_MAX_LENGTH,
  QUESTION_VALIDITY_DAYS,
} from "@/lib/whatsapp/question";
import styles from "../broadcast.module.css";

export default function OpenQuestionComposer({
  question,
  onChange,
  contactName,
  previewTime,
  translation,
}) {
  const bodyRef = useRef(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [question.body]);
  const update = (patch) => onChange({ ...question, ...patch });

  return (
    <>
      <div className={styles.composerHint}>
        {translation("Broadcast.composer.openQuestionHint")}
      </div>
      <div className={styles.phoneWrap}>
        <WhatsAppPhone contactName={contactName}>
          <WhatsAppBubble time={previewTime}>
            <textarea
              ref={bodyRef}
              aria-label={translation("Broadcast.composer.openQuestionBody")}
              placeholder={translation(
                "Broadcast.composer.openQuestionPlaceholder",
              )}
              className={phoneStyles.bodyInput}
              rows={2}
              maxLength={QUESTION_BODY_MAX_LENGTH}
              value={question.body}
              onChange={(e) => update({ body: e.target.value })}
            />
          </WhatsAppBubble>
        </WhatsAppPhone>
      </div>
      <div className={styles.quizMeta}>
        <label className={styles.quizField}>
          <span>{translation("Broadcast.composer.expectedAnswer")}</span>
          <textarea
            rows={3}
            required
            maxLength={QUESTION_FEEDBACK_MAX_LENGTH}
            value={question.expectedAnswer}
            onChange={(e) => update({ expectedAnswer: e.target.value })}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={question.aiEvaluation}
            onChange={(e) => update({ aiEvaluation: e.target.checked })}
          />{" "}
          {translation("Broadcast.composer.aiEvaluation")}
        </label>
        <div className={styles.quizFieldHint}>
          {translation("Broadcast.composer.expectedAnswerHint")}
        </div>
        <div className={styles.quizFieldHint}>
          {translation("Broadcast.composer.quizValidity", {
            days: QUESTION_VALIDITY_DAYS,
          })}
        </div>
      </div>
    </>
  );
}
