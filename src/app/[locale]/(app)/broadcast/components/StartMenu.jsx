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
 * Cartões para escolher como começar a mensagem WhatsApp.
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
        <button
          type="button"
          className={styles.startCard}
          onClick={() => onChoose("opening")}
        >
          <div className={styles.startThumb}>
            <WhatsAppPhone contactName={sampleName} compact>
              <WhatsAppBubble time={previewTime}>{openingText}</WhatsAppBubble>
              <WhatsAppButton>{OPENING_TEMPLATE_BUTTON}</WhatsAppButton>
            </WhatsAppPhone>
          </div>
          <div className={styles.startCardTitle}>
            {translation("Broadcast.start.opening")}
          </div>
          <div className={styles.startCardHint}>
            {translation("Broadcast.start.openingHint")}
          </div>
        </button>

        <button
          type="button"
          className={styles.startCard}
          onClick={() => onChoose("blank")}
        >
          <div className={styles.startThumb}>
            <WhatsAppPhone contactName={sampleName} compact>
              <WhatsAppBubble time={previewTime}>
                {translation("Broadcast.start.blankSample", {
                  name: sampleName,
                })}
              </WhatsAppBubble>
            </WhatsAppPhone>
          </div>
          <div className={styles.startCardTitle}>
            {translation("Broadcast.start.blank")}
          </div>
          <div className={styles.startCardHint}>
            {translation("Broadcast.start.blankHint")}
          </div>
        </button>
      </div>
    </div>
  );
}
