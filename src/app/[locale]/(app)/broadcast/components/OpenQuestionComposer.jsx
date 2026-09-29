"use client";

import {
  QUESTION_FEEDBACK_MAX_LENGTH,
  QUESTION_VALIDITY_DAYS,
} from "@/lib/whatsapp/question";
import styles from "../broadcast.module.css";
import QuestionPhone from "./QuestionPhone";

export default function OpenQuestionComposer({
  question,
  onChange,
  contactName,
  previewTime,
  tools,
  translation,
}) {
  const update = (patch) => onChange({ ...question, ...patch });

  return (
    <>
      <div className={styles.composerHint}>
        {translation("Broadcast.composer.openQuestionHint")}
      </div>
      <QuestionPhone
        contactName={contactName}
        previewTime={previewTime}
        body={question.body}
        onBodyChange={(body) => update({ body })}
        bodyLabel={translation("Broadcast.composer.openQuestionBody")}
        bodyPlaceholder={translation(
          "Broadcast.composer.openQuestionPlaceholder",
        )}
        tools={tools}
        translation={translation}
      />
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
