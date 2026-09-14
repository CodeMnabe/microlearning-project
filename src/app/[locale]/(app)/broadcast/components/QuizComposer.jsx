"use client";

import { useEffect, useRef } from "react";

import WhatsAppPhone, {
  WhatsAppBubble,
  WhatsAppButton,
} from "@/app/components/WhatsAppPhone/WhatsAppPhone";
import phoneStyles from "@/app/components/WhatsAppPhone/whatsAppPhone.module.css";
import {
  DEFAULT_QUIZ_FEEDBACK_CORRECT,
  DEFAULT_QUIZ_FEEDBACK_INCORRECT,
  QUESTION_BODY_MAX_LENGTH,
  QUESTION_FEEDBACK_MAX_LENGTH,
  QUESTION_VALIDITY_DAYS,
  QUIZ_MAX_OPTIONS,
  QUIZ_MIN_OPTIONS,
  QUIZ_OPTION_MAX_LENGTH,
  makeQuizOption,
} from "@/lib/whatsapp/question";

import styles from "../broadcast.module.css";

/**
 * Composição de um quiz: a pergunta escreve-se no balão e as opções nos
 * próprios botões por baixo, como o contacto as vai ver. A opção certa
 * marca-se no círculo à esquerda. Por baixo do telemóvel ficam os textos de
 * feedback.
 */
export default function QuizComposer({
  quiz,
  onChange,
  contactName,
  previewTime,
  translation,
}) {
  const bodyRef = useRef(null);

  // O campo cresce com o texto para o balão parecer uma mensagem real.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [quiz.body]);

  const options = Array.isArray(quiz.options) ? quiz.options : [];

  function update(patch) {
    onChange({ ...quiz, ...patch });
  }

  function updateOptionLabel(index, label) {
    update({
      options: options.map((option, i) =>
        i === index ? { ...option, label } : option,
      ),
    });
  }

  function markCorrect(index) {
    update({
      options: options.map((option, i) => ({ ...option, correct: i === index })),
    });
  }

  function removeOption(index) {
    if (options.length <= QUIZ_MIN_OPTIONS) return;

    const next = options.filter((_, i) => i !== index);

    if (!next.some((option) => option.correct)) {
      next[0] = { ...next[0], correct: true };
    }

    update({ options: next });
  }

  function addOption() {
    if (options.length >= QUIZ_MAX_OPTIONS) return;
    update({ options: [...options, makeQuizOption()] });
  }

  return (
    <>
      <div className={styles.composerHint}>
        {translation("Broadcast.composer.quizHint")}
      </div>

      <div className={styles.phoneWrap}>
        <WhatsAppPhone contactName={contactName}>
          <WhatsAppBubble time={previewTime}>
            <textarea
              ref={bodyRef}
              id="broadcast-quiz-body"
              aria-label={translation("Broadcast.composer.quizBody")}
              className={phoneStyles.bodyInput}
              rows={2}
              maxLength={QUESTION_BODY_MAX_LENGTH}
              value={quiz.body}
              placeholder={translation("Broadcast.composer.quizPlaceholder")}
              onChange={(e) => update({ body: e.target.value })}
            />
          </WhatsAppBubble>

          {options.map((option, index) => {
            const position = index + 1;

            return (
              <WhatsAppButton key={index} className={styles.quizOption}>
                <input
                  type="radio"
                  name="broadcast-quiz-correct"
                  className={styles.quizOptionCorrect}
                  checked={Boolean(option.correct)}
                  aria-label={translation("Broadcast.composer.quizMarkCorrect", {
                    index: position,
                  })}
                  title={translation("Broadcast.composer.quizMarkCorrect", {
                    index: position,
                  })}
                  onChange={() => markCorrect(index)}
                />

                <input
                  type="text"
                  className={styles.quizOptionInput}
                  value={option.label}
                  maxLength={QUIZ_OPTION_MAX_LENGTH}
                  aria-label={translation("Broadcast.composer.quizOption", {
                    index: position,
                  })}
                  placeholder={translation("Broadcast.composer.quizOption", {
                    index: position,
                  })}
                  onChange={(e) => updateOptionLabel(index, e.target.value)}
                />

                {options.length > QUIZ_MIN_OPTIONS ? (
                  <button
                    type="button"
                    className={styles.quizOptionRemove}
                    aria-label={translation(
                      "Broadcast.composer.quizRemoveOption",
                      { index: position },
                    )}
                    onClick={() => removeOption(index)}
                  >
                    ✕
                  </button>
                ) : null}
              </WhatsAppButton>
            );
          })}

          {options.length < QUIZ_MAX_OPTIONS ? (
            <div className={phoneStyles.rowOut}>
              <button
                type="button"
                className={styles.quizAddOption}
                onClick={addOption}
              >
                + {translation("Broadcast.composer.quizAddOption")}
              </button>
            </div>
          ) : null}
        </WhatsAppPhone>
      </div>

      <div className={styles.quizMeta}>
        <div className={styles.quizFieldHint}>
          {translation("Broadcast.composer.quizOptionLimit", {
            max: QUIZ_MAX_OPTIONS,
            chars: QUIZ_OPTION_MAX_LENGTH,
          })}
        </div>

        <label className={styles.quizField}>
          <span>{translation("Broadcast.composer.quizFeedbackCorrect")}</span>
          <textarea
            rows={2}
            maxLength={QUESTION_FEEDBACK_MAX_LENGTH}
            value={quiz.feedbackCorrect}
            placeholder={DEFAULT_QUIZ_FEEDBACK_CORRECT}
            onChange={(e) => update({ feedbackCorrect: e.target.value })}
          />
        </label>

        <label className={styles.quizField}>
          <span>{translation("Broadcast.composer.quizFeedbackIncorrect")}</span>
          <textarea
            rows={2}
            maxLength={QUESTION_FEEDBACK_MAX_LENGTH}
            value={quiz.feedbackIncorrect}
            placeholder={DEFAULT_QUIZ_FEEDBACK_INCORRECT}
            onChange={(e) => update({ feedbackIncorrect: e.target.value })}
          />
        </label>

        <div className={styles.quizFieldHint}>
          {translation("Broadcast.composer.quizFeedbackHint")}
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
