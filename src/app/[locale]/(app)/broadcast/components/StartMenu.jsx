"use client";

import WhatsAppPhone, {
  WhatsAppBubble,
  WhatsAppButton,
} from "@/app/components/WhatsAppPhone/WhatsAppPhone";

import styles from "../broadcast.module.css";

/**
 * Cartões para escolher como começar a mensagem WhatsApp: mensagem livre,
 * quiz, sondagem ou pergunta aberta. A abertura da janela não é um ponto de
 * partida: vai automaticamente a quem está fora das 24 horas, e o corpo
 * edita-se em Definições.
 */
export default function StartMenu({
  onChoose,
  sampleName,
  previewTime,
  translation,
}) {
  const cards = [
    {
      key: "blank",
      title: translation("Broadcast.start.blank"),
      hint: translation("Broadcast.start.blankHint"),
      preview: (
        <WhatsAppBubble time={previewTime}>
          {translation("Broadcast.start.blankSample", { name: sampleName })}
        </WhatsAppBubble>
      ),
    },
    {
      key: "quiz",
      title: translation("Broadcast.start.quiz"),
      hint: translation("Broadcast.start.quizHint"),
      preview: (
        <>
          <WhatsAppBubble time={previewTime}>
            {translation("Broadcast.start.quizSample", { name: sampleName })}
          </WhatsAppBubble>
          <WhatsAppButton>
            {translation("Broadcast.start.quizOptionA")}
          </WhatsAppButton>
          <WhatsAppButton>
            {translation("Broadcast.start.quizOptionB")}
          </WhatsAppButton>
          <WhatsAppButton>
            {translation("Broadcast.start.quizOptionC")}
          </WhatsAppButton>
        </>
      ),
    },
    {
      key: "survey",
      title: translation("Broadcast.start.survey"),
      hint: translation("Broadcast.start.surveyHint"),
      preview: (
        <>
          <WhatsAppBubble time={previewTime}>
            {translation("Broadcast.start.surveySample", { name: sampleName })}
          </WhatsAppBubble>
          <WhatsAppButton>
            {translation("Broadcast.start.surveyOptionA")}
          </WhatsAppButton>
          <WhatsAppButton>
            {translation("Broadcast.start.surveyOptionB")}
          </WhatsAppButton>
          <WhatsAppButton>
            {translation("Broadcast.start.surveyOptionC")}
          </WhatsAppButton>
        </>
      ),
    },
    {
      key: "question",
      title: translation("Broadcast.start.question"),
      hint: translation("Broadcast.start.questionHint"),
      preview: (
        <WhatsAppBubble time={previewTime}>
          {translation("Broadcast.start.questionSample", { name: sampleName })}
        </WhatsAppBubble>
      ),
    },
  ];

  return (
    <div className={styles.panel} data-testid="start-menu">
      <div className={styles.startIntro}>
        <div className={styles.startTitle}>
          {translation("Broadcast.start.title")}
        </div>
        <div className={styles.startHint}>
          {translation("Broadcast.start.hint")}
        </div>
      </div>

      <div className={styles.startGrid}>
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={styles.startCard}
            data-testid={`start-card-${card.key}`}
            onClick={() => onChoose(card.key)}
          >
            <div className={styles.startThumb}>
              <WhatsAppPhone contactName={sampleName} compact centered>
                {card.preview}
              </WhatsAppPhone>
            </div>
            <div className={styles.startCardText}>
              <div className={styles.startCardTitle}>
                <span>{card.title}</span>
              </div>
              <div className={styles.startCardHint}>{card.hint}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
