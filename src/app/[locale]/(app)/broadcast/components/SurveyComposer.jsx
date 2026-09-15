"use client";

import { WhatsAppButton } from "@/app/components/WhatsAppPhone/WhatsAppPhone";
import phoneStyles from "@/app/components/WhatsAppPhone/whatsAppPhone.module.css";
import {
  DEFAULT_SURVEY_THANKS,
  QUESTION_FEEDBACK_MAX_LENGTH,
  QUESTION_VALIDITY_DAYS,
  QUIZ_MAX_OPTIONS,
  QUIZ_MIN_OPTIONS,
  QUIZ_OPTION_MAX_LENGTH,
  makeQuizOption,
} from "@/lib/whatsapp/question";

import styles from "../broadcast.module.css";
import QuestionPhone from "./QuestionPhone";

/**
 * Composição de uma sondagem: a pergunta no balão e as opções nos botões,
 * como no quiz, mas sem resposta certa nem errada. Por baixo do telemóvel
 * fica o agradecimento opcional enviado depois da escolha.
 */
export default function SurveyComposer({
  survey,
  onChange,
  contactName,
  previewTime,
  tools,
  translation,
}) {
  const options = Array.isArray(survey.options) ? survey.options : [];

  function update(patch) {
    onChange({ ...survey, ...patch });
  }

  function updateOptionLabel(index, label) {
    update({
      options: options.map((option, i) =>
        i === index ? { ...option, label } : option,
      ),
    });
  }

  function removeOption(index) {
    if (options.length <= QUIZ_MIN_OPTIONS) return;
    update({ options: options.filter((_, i) => i !== index) });
  }

  function addOption() {
    if (options.length >= QUIZ_MAX_OPTIONS) return;
    update({ options: [...options, makeQuizOption()] });
  }

  return (
    <>
      <div className={styles.composerHint}>
        {translation("Broadcast.composer.surveyHint")}
      </div>

      <QuestionPhone
        contactName={contactName}
        previewTime={previewTime}
        body={survey.body}
        onBodyChange={(body) => update({ body })}
        bodyLabel={translation("Broadcast.composer.surveyBody")}
        bodyPlaceholder={translation("Broadcast.composer.surveyPlaceholder")}
        tools={tools}
        translation={translation}
      >
        {options.map((option, index) => {
          const position = index + 1;

          return (
            <WhatsAppButton key={index} className={styles.quizOption}>
              <input
                type="text"
                className={styles.quizOptionInput}
                value={option.label}
                maxLength={QUIZ_OPTION_MAX_LENGTH}
                aria-label={translation("Broadcast.composer.surveyOption", {
                  index: position,
                })}
                placeholder={translation("Broadcast.composer.surveyOption", {
                  index: position,
                })}
                onChange={(e) => updateOptionLabel(index, e.target.value)}
              />

              {options.length > QUIZ_MIN_OPTIONS ? (
                <button
                  type="button"
                  className={styles.quizOptionRemove}
                  aria-label={translation(
                    "Broadcast.composer.surveyRemoveOption",
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
      </QuestionPhone>

      <div className={styles.quizMeta}>
        <div className={styles.quizFieldHint}>
          {translation("Broadcast.composer.quizOptionLimit", {
            max: QUIZ_MAX_OPTIONS,
            chars: QUIZ_OPTION_MAX_LENGTH,
          })}
        </div>

        <label className={styles.quizField}>
          <span>{translation("Broadcast.composer.surveyThanks")}</span>
          <textarea
            rows={2}
            maxLength={QUESTION_FEEDBACK_MAX_LENGTH}
            value={survey.thanksText}
            placeholder={DEFAULT_SURVEY_THANKS}
            onChange={(e) => update({ thanksText: e.target.value })}
          />
        </label>

        <div className={styles.quizFieldHint}>
          {translation("Broadcast.composer.surveyThanksHint")}
        </div>

        <div className={styles.quizFieldHint}>
          {translation("Broadcast.composer.surveyValidity", {
            days: QUESTION_VALIDITY_DAYS,
          })}
        </div>
      </div>
    </>
  );
}
