"use client";

import WhatsAppPhone, {
  WhatsAppBubble,
  WhatsAppButton,
} from "@/app/components/WhatsAppPhone/WhatsAppPhone";
import {
  OPENING_TEMPLATE_BUTTON,
  renderOpeningMessage,
} from "@/lib/whatsapp/openingTemplate";

import styles from "../broadcast.module.css";

/**
 * Cartões para escolher como começar a mensagem WhatsApp. A pergunta aberta
 * fica visível mas desativada até ser implementada.
 */
export default function StartMenu({
  onChoose,
  sampleName,
  orgName,
  openingBody,
  previewTime,
  translation,
}) {
  const openingText = renderOpeningMessage({
    name: sampleName,
    orgName,
    body: openingBody,
  });

  const cards = [
    {
      key: "opening",
      title: translation("Broadcast.start.opening"),
      hint: translation("Broadcast.start.openingHint"),
      preview: (
        <>
          <WhatsAppBubble time={previewTime}>{openingText}</WhatsAppBubble>
          <WhatsAppButton>{OPENING_TEMPLATE_BUTTON}</WhatsAppButton>
        </>
      ),
    },
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
      key: "question",
      soon: true,
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
            className={`${styles.startCard} ${card.soon ? styles.startCardSoon : ""}`}
            disabled={Boolean(card.soon)}
            data-testid={`start-card-${card.key}`}
            onClick={card.soon ? undefined : () => onChoose(card.key)}
          >
            <div className={styles.startThumb}>
              <WhatsAppPhone contactName={sampleName} compact centered>
                {card.preview}
              </WhatsAppPhone>
            </div>
            <div className={styles.startCardText}>
              <div className={styles.startCardTitle}>
                <span>{card.title}</span>
                {card.soon ? (
                  <span className={styles.startCardBadge}>
                    {translation("Broadcast.start.soon")}
                  </span>
                ) : null}
              </div>
              <div className={styles.startCardHint}>{card.hint}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
